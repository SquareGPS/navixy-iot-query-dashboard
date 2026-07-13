import { describe, it, expect } from 'vitest';
import { readPanelDraft, panelDraftHasUnsavedChanges } from '../panelDraft';
import type { Panel } from '@/types/dashboard-types';

const gridPos = { x: 0, y: 0, w: 12, h: 8 };

function tablePanel(): Panel {
  return {
    id: 'p1',
    type: 'table',
    title: 'Sales',
    description: 'Quarterly numbers',
    gridPos,
    'x-navixy': {
      sql: { statement: 'SELECT 1', params: {} },
      filters: [{ variable: 'period', column: 'ts' }],
      dataset: { shape: 'table', columns: {} },
      verify: { max_rows: 500 },
      visualization: { showHeader: true, sortable: false },
    },
  };
}

describe('readPanelDraft', () => {
  it('reads every editable field from a data panel', () => {
    expect(readPanelDraft(tablePanel())).toEqual({
      title: 'Sales',
      description: 'Quarterly numbers',
      panelType: 'table',
      sql: 'SELECT 1',
      maxRows: 500,
      visualization: { showHeader: true, sortable: false },
      textMode: 'markdown',
      textContent: '',
      filterBindings: { period: 'ts' },
    });
  });

  it('falls back to defaults when nothing is configured', () => {
    const bare: Panel = { id: 'b', type: 'kpi', title: 'Count', gridPos };
    const draft = readPanelDraft(bare);
    expect(draft.description).toBe('');
    expect(draft.sql).toBe('');
    expect(draft.maxRows).toBe(1000);
    expect(draft.visualization).toBeUndefined();
    expect(draft.textMode).toBe('markdown');
    expect(draft.filterBindings).toEqual({});
  });

  it('preserves a stored max_rows of 0 instead of coercing it to 1000', () => {
    const zeroRows: Panel = { id: 'z', type: 'table', title: 'T', gridPos, 'x-navixy': { verify: { max_rows: 0 } } };
    expect(readPanelDraft(zeroRows).maxRows).toBe(0);
  });

  it('reads text-panel content from options.* and x-navixy.text.*', () => {
    const viaOptions: Panel = { id: 't1', type: 'text', title: 'Note', gridPos, options: { mode: 'html', content: '<b>hi</b>' } };
    expect(readPanelDraft(viaOptions).textMode).toBe('html');
    expect(readPanelDraft(viaOptions).textContent).toBe('<b>hi</b>');

    const viaNavixy: Panel = { id: 't2', type: 'text', title: 'Note', gridPos, 'x-navixy': { text: { format: 'text', content: 'plain' } } };
    expect(readPanelDraft(viaNavixy).textMode).toBe('text');
    expect(readPanelDraft(viaNavixy).textContent).toBe('plain');
  });
});

describe('panelDraftHasUnsavedChanges', () => {
  const pristine = readPanelDraft(tablePanel());

  it('is clean when nothing changed', () => {
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine })).toBe(false);
  });

  // A change to ANY editable field must arm Save — the direction that must
  // never fail (a missed change would silently block the user from saving).
  it('is dirty when any editable field changes', () => {
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, title: 'Revenue' })).toBe(true);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, description: 'Annual' })).toBe(true);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, panelType: 'barchart' })).toBe(true);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, sql: 'SELECT 2' })).toBe(true);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, maxRows: 1000 })).toBe(true);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, textMode: 'html' })).toBe(true);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, textContent: 'x' })).toBe(true);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, visualization: { showHeader: false, sortable: false } })).toBe(true);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, filterBindings: { period: 'created_at' } })).toBe(true);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, filterBindings: {} })).toBe(true);
  });

  it('ignores visualization key order', () => {
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, visualization: { sortable: false, showHeader: true } })).toBe(false);
  });

  // handleSave stores title/description/sql trimmed, so a whitespace-only edit
  // persists nothing new and must not arm Save.
  it('treats a whitespace-only edit of title/description/sql as clean', () => {
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, title: '  Sales  ' })).toBe(false);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, description: 'Quarterly numbers\n' })).toBe(false);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, sql: '  SELECT 1\n' })).toBe(false);
  });

  // handleSave persists only bindings with a non-empty column, so ticking a
  // filter without a column (or a whitespace-only one) writes nothing new.
  it('ignores an enabled-but-column-less filter binding', () => {
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, filterBindings: { ...pristine.filterBindings, region: '' } })).toBe(false);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, filterBindings: { ...pristine.filterBindings, region: '   ' } })).toBe(false);
  });

  it('compares filter columns trimmed, and is dirty for a real new binding', () => {
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, filterBindings: { period: '  ts  ' } })).toBe(false);
    expect(panelDraftHasUnsavedChanges(pristine, { ...pristine, filterBindings: { ...pristine.filterBindings, region: 'city' } })).toBe(true);
  });

  // textContent is stored verbatim, so its whitespace is significant.
  it('treats a whitespace edit of textContent as a change', () => {
    const withText = { ...pristine, textContent: 'hello' };
    expect(panelDraftHasUnsavedChanges(withText, { ...withText, textContent: 'hello ' })).toBe(true);
  });

  it('goes clean again once an edit is reverted to the original', () => {
    const edited = { ...pristine, title: 'Revenue' };
    expect(panelDraftHasUnsavedChanges(pristine, edited)).toBe(true);
    expect(panelDraftHasUnsavedChanges(pristine, { ...edited, title: 'Sales' })).toBe(false);
  });
});
