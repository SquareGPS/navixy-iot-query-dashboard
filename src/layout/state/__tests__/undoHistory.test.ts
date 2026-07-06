import { describe, it, expect, beforeEach } from 'vitest';
import {
  cmdMovePanel,
  cmdAddRow,
  cmdMoveRow,
  cmdReorderRows,
  cmdToggleRowCollapsed,
  cmdCanonicalizeRows,
} from '../commands';
import { useEditorStore } from '../editorStore';
import type { Dashboard, Panel } from '@/types/dashboard-types';

// A single free-floating panel keeps cmdMovePanel placements exact (no collisions to
// resolve), so we can walk the undo history deterministically.
function singlePanelDash(): Dashboard {
  const p: Panel = { id: 'p1', type: 'text', title: 'p1', gridPos: { x: 0, y: 0, w: 6, h: 4 } };
  return { title: 'test', time: { from: '', to: '' }, panels: [p] };
}

const xOf = () => useEditorStore.getState().dashboard!.panels.find((p) => p.id === 'p1')!.gridPos.x;

// Serialize the layout-relevant shape (positions + row nesting) so a test can assert
// that undo restores it byte-for-byte.
function layoutShape(): string {
  const shape = (p: Panel): unknown => ({
    id: p.id,
    type: p.type,
    gridPos: p.gridPos,
    collapsed: p.collapsed,
    panels: p.panels?.map(shape),
  });
  return JSON.stringify(useEditorStore.getState().dashboard!.panels.map(shape));
}

function load(panels: Panel[]) {
  const store = useEditorStore.getState();
  store.reset();
  store.setDashboard({ title: 'test', time: { from: '', to: '' }, panels });
}

function twoRowsWithChildren(): Panel[] {
  return [
    { id: 'r1', type: 'row', title: 'r1', collapsed: false, gridPos: { x: 0, y: 0, w: 24, h: 1 } },
    { id: 'a', type: 'text', title: 'a', gridPos: { x: 0, y: 1, w: 6, h: 4 } },
    { id: 'r2', type: 'row', title: 'r2', collapsed: false, gridPos: { x: 0, y: 6, w: 24, h: 1 } },
    { id: 'b', type: 'text', title: 'b', gridPos: { x: 0, y: 7, w: 6, h: 4 } },
  ];
}

describe('editor-store undo/redo history (DO-291)', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('records EVERY edit so undo walks back multiple steps (regression: was capped at one)', () => {
    const store = useEditorStore.getState();
    store.setDashboard(singlePanelDash());

    const x0 = xOf();
    expect(store.canUndo()).toBe(false);

    cmdMovePanel('p1', 2, 0);
    const x1 = xOf();
    cmdMovePanel('p1', 4, 0);
    const x2 = xOf();
    cmdMovePanel('p1', 6, 0);
    const x3 = xOf();

    // The three moves are distinct so each undo has an observable effect.
    expect(x1).toBeGreaterThan(x0);
    expect(x2).toBeGreaterThan(x1);
    expect(x3).toBeGreaterThan(x2);
    expect(useEditorStore.getState().undoStack.length).toBe(3);

    // Multi-level undo: each step restores the *immediately* prior layout.
    useEditorStore.getState().undo();
    expect(xOf()).toBe(x2);
    useEditorStore.getState().undo();
    expect(xOf()).toBe(x1);
    useEditorStore.getState().undo();
    expect(xOf()).toBe(x0);
    expect(useEditorStore.getState().canUndo()).toBe(false);
  });

  it('redo re-applies undone edits until a new edit invalidates the redo stack', () => {
    useEditorStore.getState().setDashboard(singlePanelDash());
    cmdMovePanel('p1', 2, 0);
    const x1 = xOf();
    cmdMovePanel('p1', 6, 0);
    const x2 = xOf();

    useEditorStore.getState().undo();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().canRedo()).toBe(true);

    useEditorStore.getState().redo();
    expect(xOf()).toBe(x1);
    useEditorStore.getState().redo();
    expect(xOf()).toBe(x2);
    expect(useEditorStore.getState().canRedo()).toBe(false);

    // A fresh edit after an undo must clear the redo stack.
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().redoStack.length).toBe(1);
    cmdMovePanel('p1', 10, 0);
    expect(useEditorStore.getState().redoStack.length).toBe(0);
  });

  it('setDashboard (loading a dashboard) starts a fresh, empty history', () => {
    useEditorStore.getState().setDashboard(singlePanelDash());
    cmdMovePanel('p1', 2, 0);
    cmdMovePanel('p1', 4, 0);
    expect(useEditorStore.getState().undoStack.length).toBeGreaterThan(0);

    // Loading a new dashboard is not an undoable edit — it resets the timeline.
    useEditorStore.getState().setDashboard(singlePanelDash());
    expect(useEditorStore.getState().undoStack.length).toBe(0);
    expect(useEditorStore.getState().redoStack.length).toBe(0);
    expect(useEditorStore.getState().canUndo()).toBe(false);
  });

  it('a content/filter save during edit mode resets the layout undo history (intentional)', () => {
    // Scenario (MR35 review #1): while editing layout the user saves panel content
    // or dashboard filters. Both save paths (handleSavePanel / handleSaveVariables
    // in ReportView) replace the dashboard via store.setDashboard, which starts a
    // fresh history. This is deliberate — undo snapshots share panel content by
    // reference (see clonePanelForHistory), so replaying an older layout snapshot
    // after a content save could silently roll the save back. Lock the contract in
    // so a future change that tries to preserve layout-undo does so consciously.
    useEditorStore.getState().setDashboard(singlePanelDash());
    useEditorStore.getState().setIsEditingLayout(true);

    cmdMovePanel('p1', 2, 0);
    cmdMovePanel('p1', 4, 0);
    expect(useEditorStore.getState().undoStack.length).toBe(2);

    // A panel-content / filter save persists then reloads via setDashboard.
    useEditorStore.getState().setDashboard(useEditorStore.getState().dashboard!);

    expect(useEditorStore.getState().undoStack.length).toBe(0);
    expect(useEditorStore.getState().redoStack.length).toBe(0);
    expect(useEditorStore.getState().canUndo()).toBe(false);
  });

  it('cmdCanonicalizeRows commits an undoable step instead of wiping history (review #2)', () => {
    // It used to route through setDashboard (clears both stacks). Now it goes
    // through commit like every other cmd*, so wiring it into a save flow can no
    // longer silently drop the user's prior layout-edit undo history.
    useEditorStore.getState().setDashboard(singlePanelDash());
    cmdMovePanel('p1', 2, 0);
    cmdMovePanel('p1', 4, 0);
    expect(useEditorStore.getState().undoStack.length).toBe(2);

    cmdCanonicalizeRows();

    // Preserved and grown by one (the old setDashboard path would have reset to 0).
    expect(useEditorStore.getState().undoStack.length).toBe(3);

    // Earlier moves are still reachable through undo.
    useEditorStore.getState().undo(); // undo canonicalize
    useEditorStore.getState().undo(); // undo the second move
    expect(xOf()).toBe(2);
  });
});

// Row/add/delete geometry helpers mutate the dashboard they are handed *in place*
// while computing the next layout. The command layer must snapshot the pre-edit
// dashboard as an independent deep copy BEFORE calling them, or undo restores a
// layout the helper has already scribbled on (the whole undo stack shares those
// objects). These ops all reposition an *existing* panel, so they exercise the bug
// that a move/resize-only suite misses. See cloneDashboard in commands.ts.
describe('editor-store undo restores the exact pre-edit layout (DO-291 in-place mutation)', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('undo of cmdMoveRow restores the moved row and its band children', () => {
    load(twoRowsWithChildren());
    const before = layoutShape();

    cmdMoveRow('r2', 3);
    expect(layoutShape()).not.toBe(before); // the op actually changed the layout

    useEditorStore.getState().undo();
    expect(layoutShape()).toBe(before);
  });

  it('undo of cmdReorderRows restores the original row order and positions', () => {
    load(twoRowsWithChildren());
    const before = layoutShape();

    cmdReorderRows(['r2', 'r1']);
    expect(layoutShape()).not.toBe(before);

    useEditorStore.getState().undo();
    expect(layoutShape()).toBe(before);
  });

  it('undo of cmdToggleRowCollapsed (expand) restores the collapsed layout', () => {
    load([
      {
        id: 'r1', type: 'row', title: 'r1', collapsed: true, gridPos: { x: 0, y: 0, w: 24, h: 1 },
        panels: [{ id: 'c', type: 'text', title: 'c', gridPos: { x: 0, y: 0, w: 6, h: 4 } }],
      },
      { id: 'p', type: 'text', title: 'p', gridPos: { x: 0, y: 2, w: 6, h: 4 } },
    ]);
    const before = layoutShape();

    cmdToggleRowCollapsed('r1', false);
    expect(layoutShape()).not.toBe(before);

    useEditorStore.getState().undo();
    expect(layoutShape()).toBe(before);
  });

  it('undo of cmdAddRow removes the row and restores the prior layout', () => {
    load([{ id: 'p1', type: 'text', title: 'p1', gridPos: { x: 0, y: 0, w: 6, h: 4 } }]);
    const before = layoutShape();

    cmdAddRow(0, 'New row');
    expect(useEditorStore.getState().dashboard!.panels.some((p) => p.type === 'row')).toBe(true);

    useEditorStore.getState().undo();
    expect(layoutShape()).toBe(before);
    expect(useEditorStore.getState().dashboard!.panels.some((p) => p.type === 'row')).toBe(false);
  });

  it('walks back multiple in-place edits, each restoring its immediate predecessor', () => {
    load(twoRowsWithChildren());
    const s0 = layoutShape();
    cmdMoveRow('r2', 3);
    const s1 = layoutShape();
    cmdReorderRows(['r2', 'r1']);
    const s2 = layoutShape();

    expect(s1).not.toBe(s0);
    expect(s2).not.toBe(s1);

    useEditorStore.getState().undo();
    expect(layoutShape()).toBe(s1); // not corrupted by the later reorder
    useEditorStore.getState().undo();
    expect(layoutShape()).toBe(s0); // not corrupted by either later edit
  });

  it('redo re-applies an undone in-place edit', () => {
    load(twoRowsWithChildren());
    cmdMoveRow('r2', 3);
    const afterMove = layoutShape();

    useEditorStore.getState().undo();
    useEditorStore.getState().redo();
    expect(layoutShape()).toBe(afterMove);
  });
});
