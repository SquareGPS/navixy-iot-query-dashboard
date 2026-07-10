import { describe, it, expect, beforeEach } from 'vitest';
import { cmdAddPanel, cmdAddPresetPanel, cmdDuplicatePanel, cmdMovePanel } from '../commands';
import { useEditorStore } from '../editorStore';
import type { Panel } from '@/types/dashboard-types';
import type { ChartPresetPanel } from '@/types/chart-catalog';

function loadDashboard(panels: Panel[]): void {
  const store = useEditorStore.getState();
  store.reset();
  store.setDashboard({ title: 'test', time: { from: '', to: '' }, panels });
}

const selectedId = () => useEditorStore.getState().selectedPanelId;
const panels = () => useEditorStore.getState().dashboard!.panels;

// DO-304: adding a widget in edit mode left nothing selected, so the user had to
// click the fresh panel before they could move or configure it. Every command that
// creates a panel now selects it. These pin that down at the command layer — the one
// place all add paths (toolbar add, ghost placement, chart-library drop, duplicate)
// funnel through.
describe('a newly created panel is auto-selected (DO-304)', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('cmdAddPanel selects the panel it just added', () => {
    loadDashboard([]);
    expect(selectedId()).toBeNull();

    cmdAddPanel({ type: 'stat', target: 'top', hint: { position: { x: 0, y: 0 } } });

    const created = panels().find((p) => p.type === 'stat');
    expect(created).toBeDefined();
    expect(selectedId()).toBe(created!.id);
  });

  it('cmdAddPanel selects the new panel even when another was already selected', () => {
    loadDashboard([{ id: 'p1', type: 'text', title: 'p1', gridPos: { x: 0, y: 0, w: 6, h: 4 } }]);
    useEditorStore.getState().setSelectedPanel('p1');

    cmdAddPanel({ type: 'barchart', target: 'top', hint: { position: { x: 0, y: 8 } } });

    const created = panels().find((p) => p.type === 'barchart');
    expect(created).toBeDefined();
    expect(selectedId()).toBe(created!.id);
    expect(selectedId()).not.toBe('p1');
  });

  it('cmdAddPresetPanel selects the dropped preset panel', () => {
    loadDashboard([]);
    const preset: ChartPresetPanel = { type: 'piechart', title: 'Preset', gridPos: { w: 8, h: 8 } };

    cmdAddPresetPanel(preset, { x: 0, y: 0 });

    const created = panels().find((p) => p.type === 'piechart');
    expect(created).toBeDefined();
    expect(selectedId()).toBe(created!.id);
  });

  it('cmdDuplicatePanel selects the duplicate, not the original', () => {
    loadDashboard([{ id: 'p1', type: 'stat', title: 'p1', gridPos: { x: 0, y: 0, w: 6, h: 4 } }]);

    cmdDuplicatePanel('p1');

    const duplicate = panels().find((p) => p.id !== 'p1');
    expect(duplicate).toBeDefined();
    expect(selectedId()).toBe(duplicate!.id);
    expect(selectedId()).not.toBe('p1');
  });

  it('the auto-selected id points to a panel present in the committed dashboard', () => {
    loadDashboard([]);
    cmdAddPanel({ type: 'table', target: 'top', hint: { position: { x: 0, y: 0 } } });

    const id = selectedId();
    expect(panels().some((p) => p.id === id)).toBe(true);
  });
});

// MR !44 review follow-up: because a created panel is now auto-selected, undoing the
// add would otherwise leave selectedPanelId pointing at a panel that no longer exists.
// undo/redo drop a selection the restored layout doesn't contain, so the id never
// dangles — while a still-present selection is preserved.
describe('undo/redo drop a selection the restored layout no longer contains (DO-304 follow-up)', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('undoing an add clears the selection that add set', () => {
    loadDashboard([]);
    cmdAddPanel({ type: 'stat', target: 'top', hint: { position: { x: 0, y: 0 } } });
    expect(selectedId()).not.toBeNull();

    useEditorStore.getState().undo();

    expect(panels().length).toBe(0);
    expect(selectedId()).toBeNull();
  });

  it('undo preserves a selection that still exists in the restored layout', () => {
    loadDashboard([{ id: 'p1', type: 'text', title: 'p1', gridPos: { x: 0, y: 0, w: 6, h: 4 } }]);
    useEditorStore.getState().setSelectedPanel('p1');

    cmdMovePanel('p1', 2, 0); // an undoable edit that doesn't touch selection
    useEditorStore.getState().undo();

    expect(panels().some((p) => p.id === 'p1')).toBe(true);
    expect(selectedId()).toBe('p1');
  });

  it('after add → undo → redo the selection never points at a removed panel', () => {
    loadDashboard([]);
    cmdAddPanel({ type: 'table', target: 'top', hint: { position: { x: 0, y: 0 } } });

    useEditorStore.getState().undo();
    expect(selectedId()).toBeNull();

    useEditorStore.getState().redo();

    // The panel is restored; the invariant is that selectedPanelId is either null or
    // resolves to a present panel — never a dangling id.
    expect(panels().length).toBe(1);
    const id = selectedId();
    expect(id === null || panels().some((p) => p.id === id)).toBe(true);
  });
});
