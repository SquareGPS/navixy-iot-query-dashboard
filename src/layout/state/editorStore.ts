/**
 * Editor store for dashboard layout editing
 * Manages dashboard state, selection, edit mode, and undo/redo
 */

import { create } from 'zustand';
import type { GrafanaDashboard, GrafanaPanel } from '@/types/grafana-dashboard';

export interface EditorState {
  dashboard: GrafanaDashboard | null;
  selectedPanelId: number | null;
  isEditingLayout: boolean;
  undoStack: GrafanaDashboard[];
  redoStack: GrafanaDashboard[];
  maxUndoHistory: number;
}

export interface EditorActions {
  setDashboard: (dashboard: GrafanaDashboard) => void;
  setSelectedPanel: (panelId: number | null) => void;
  setIsEditingLayout: (isEditing: boolean) => void;
  pushToHistory: (previousDashboard: GrafanaDashboard) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
}

export type EditorStore = EditorState & EditorActions;

const initialState: EditorState = {
  dashboard: null,
  selectedPanelId: null,
  isEditingLayout: false,
  undoStack: [],
  redoStack: [],
  maxUndoHistory: 50,
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...initialState,

  setDashboard: (dashboard: GrafanaDashboard) => {
    console.log('setDashboard called with panels count:', dashboard.panels.length);
    // Ensure we create a new object reference for Zustand to detect the change
    set({ 
      dashboard: { ...dashboard, panels: [...dashboard.panels] }, 
      undoStack: [], 
      redoStack: [] 
    });
  },

  setSelectedPanel: (panelId: number | null) => {
    set({ selectedPanelId: panelId });
  },

  setIsEditingLayout: (isEditing: boolean) => {
    set({ isEditingLayout: isEditing });
  },

  pushToHistory: (previousDashboard: GrafanaDashboard) => {
    const state = get();
    const newUndoStack = [...state.undoStack, previousDashboard].slice(-state.maxUndoHistory);
    
    set({
      undoStack: newUndoStack,
      redoStack: [], // Clear redo stack on new action
      // Note: dashboard is NOT updated here - it should already be updated by setDashboard before calling pushToHistory
    });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0 || !state.dashboard) {
      return;
    }

    const previousDashboard = state.undoStack[state.undoStack.length - 1];
    const newUndoStack = state.undoStack.slice(0, -1);
    const newRedoStack = [...state.redoStack, state.dashboard];

    set({
      dashboard: previousDashboard,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0 || !state.dashboard) {
      return;
    }

    const nextDashboard = state.redoStack[state.redoStack.length - 1];
    const newRedoStack = state.redoStack.slice(0, -1);
    const newUndoStack = [...state.undoStack, state.dashboard];

    set({
      dashboard: nextDashboard,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
    });
  },

  canUndo: () => {
    return get().undoStack.length > 0;
  },

  canRedo: () => {
    return get().redoStack.length > 0;
  },

  reset: () => {
    set(initialState);
  },
}));

