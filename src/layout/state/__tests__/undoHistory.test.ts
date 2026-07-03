import { describe, it, expect, beforeEach } from 'vitest';
import { cmdMovePanel } from '../commands';
import { useEditorStore } from '../editorStore';
import type { Dashboard, Panel } from '@/types/dashboard-types';

// A single free-floating panel keeps cmdMovePanel placements exact (no collisions to
// resolve), so we can walk the undo history deterministically.
function singlePanelDash(): Dashboard {
  const p: Panel = { id: 'p1', type: 'text', title: 'p1', gridPos: { x: 0, y: 0, w: 6, h: 4 } };
  return { title: 'test', time: { from: '', to: '' }, panels: [p] };
}

const xOf = () => useEditorStore.getState().dashboard!.panels.find((p) => p.id === 'p1')!.gridPos.x;

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
});
