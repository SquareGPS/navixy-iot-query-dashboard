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
    // Nullish, not ||, so a stored 0 round-trips instead of being rewritten to 1000.
    maxRows: navixyConfig?.verify?.max_rows ?? 1000,
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
 * The filter bindings the save path actually persists: those with a non-empty
 * column, stored trimmed. Mirrors the `filters` build in PanelEditor's
 * handleSave, which drops empty/whitespace columns — so an enabled-but-
 * column-less filter (or a whitespace-only column) writes nothing.
 *
 * handleSave additionally drops bindings whose variable is no longer a
 * dashboard filter, but those are never user-reachable here (the Filters tab
 * only lists current dashboard filters), so the empty-column rule alone matches
 * the persisted result for every state the editor can produce — and needs no
 * localFilters, keeping the dirty check a pure function of the draft.
 */
function persistedFilterBindings(bindings: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [variable, column] of Object.entries(bindings)) {
    const trimmed = column.trim();
    if (trimmed) out[variable] = trimmed;
  }
  return out;
}

/**
 * Whether an in-progress draft would persist anything different from the panel
 * it was loaded from.
 *
 * Fields are normalized to what the save path actually stores before comparing,
 * so an edit that persists nothing new does not arm Save:
 * - title/description/SQL are trimmed (handleSave stores them trimmed);
 * - filter bindings are reduced to the ones handleSave keeps (non-empty column).
 * textContent is stored verbatim, so it is intentionally compared as-is.
 */
export function panelDraftHasUnsavedChanges(pristine: PanelDraft, draft: PanelDraft): boolean {
  const normalize = (d: PanelDraft): PanelDraft => ({
    ...d,
    title: d.title.trim(),
    description: d.description.trim(),
    sql: d.sql.trim(),
    filterBindings: persistedFilterBindings(d.filterBindings),
  });
  return !deepEqual(normalize(pristine), normalize(draft));
}
