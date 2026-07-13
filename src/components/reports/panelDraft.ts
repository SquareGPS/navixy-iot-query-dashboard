import type { Panel } from '@/types/dashboard-types';
import { deepEqual } from '@/utils/deepEqual';

/**
 * Pure helpers behind the panel editor's unsaved-changes tracking (DO-307),
 * kept out of the component module so they can be unit-tested without pulling
 * in React and the whole dialog.
 */

/** Read a panel's existing filter bindings into a {variable: column} map. */
function initFilterBindings(panel: Panel): Record<string, string> {
  const map: Record<string, string> = {};
  (panel['x-navixy']?.filters || []).forEach((f) => {
    map[f.variable] = f.column;
  });
  return map;
}

/**
 * The panel fields this editor lets you change, read into a flat draft. Used to
 * seed the form, to reset it when a different panel loads, and — via
 * {@link panelDraftHasUnsavedChanges} — to tell whether there are unsaved
 * changes.
 */
export function readPanelDraft(panel: Panel) {
  const navixyConfig = panel['x-navixy'];
  // Text panels carry their content under either options.* or x-navixy.text.*.
  const navixyText = navixyConfig?.text;
  return {
    title: panel.title,
    description: panel.description || '',
    panelType: panel.type,
    // Preserve the SQL exactly as saved — formatSql can rewrite/truncate it.
    sql: navixyConfig?.sql?.statement || '',
    maxRows: navixyConfig?.verify?.max_rows || 1000,
    visualization: navixyConfig?.visualization,
    textMode:
      (panel.options?.mode as 'markdown' | 'html' | 'text') ||
      (navixyText?.format as 'markdown' | 'html' | 'text') ||
      'markdown',
    textContent: (panel.options?.content as string | undefined) || navixyText?.content || '',
    filterBindings: initFilterBindings(panel),
  };
}

export type PanelDraft = ReturnType<typeof readPanelDraft>;

/**
 * Whether an in-progress draft would persist anything different from the panel
 * it was loaded from.
 *
 * Title, description and SQL are compared trimmed, because the save path stores
 * them trimmed (`title.trim()` etc.) — so a whitespace-only edit is not a real
 * change and must not arm Save for a no-op write. textContent is stored
 * verbatim, so it is intentionally compared as-is.
 */
export function panelDraftHasUnsavedChanges(pristine: PanelDraft, draft: PanelDraft): boolean {
  const normalize = (d: PanelDraft): PanelDraft => ({
    ...d,
    title: d.title.trim(),
    description: d.description.trim(),
    sql: d.sql.trim(),
  });
  return !deepEqual(normalize(pristine), normalize(draft));
}
