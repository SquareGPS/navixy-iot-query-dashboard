/**
 * Editor store for dashboard layout editing
 * Manages dashboard state, selection, edit mode, and undo/redo
 */

import { create } from 'zustand';
import type { Dashboard } from '@/types/dashboard-types';
import { isRowPanel, toggleRowCollapsed } from '../geometry/rows';
import { idEq } from '../geometry/idUtils';

/**
 * Whether a panel id still resolves to a panel in this dashboard (top-level or nested
 * inside a row). Used by undo/redo to drop a selection the restored layout no longer
 * contains — e.g. undoing an add deselects the panel it just removed — so
 * selectedPanelId never dangles (DO-304 review follow-up).
 */
function dashboardHasPanel(dashboard: Dashboard, id: string | number): boolean {
  return dashboard.panels.some(
    (panel) =>
      idEq(panel.id, id) ||
      (isRowPanel(panel) ? (panel.panels?.some((child) => idEq(child.id, id)) ?? false) : false)
  );
}

export interface EditorState {
  dashboard: Dashboard | null;
  selectedPanelId: string | number | null;
  isEditingLayout: boolean;
  chartLibraryOpen: boolean;
  undoStack: Dashboard[];
  redoStack: Dashboard[];
  maxUndoHistory: number;
  // Track original collapsed states of rows before entering edit mode
  originalCollapsedStates: Map<string | number, boolean>;
}

export interface EditorActions {
  setDashboard: (dashboard: Dashboard) => void;
  setSelectedPanel: (panelId: string | number | null) => void;
  setIsEditingLayout: (isEditing: boolean) => void;
  setChartLibraryOpen: (open: boolean) => void;
  toggleChartLibrary: () => void;
  setOriginalCollapsedStates: (states: Map<string | number, boolean>) => void;
  clearOriginalCollapsedStates: () => void;
  commit: (nextDashboard: Dashboard, previousDashboard: Dashboard) => void;
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
  chartLibraryOpen: false,
  undoStack: [],
  redoStack: [],
  maxUndoHistory: 50,
  originalCollapsedStates: new Map(),
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...initialState,

  setDashboard: (dashboard: Dashboard) => {
    // Ensure we create a new object reference for Zustand to detect the change
    set({ 
      dashboard: { ...dashboard, panels: [...dashboard.panels] }, 
      undoStack: [], 
      redoStack: [] 
    });
  },

  setSelectedPanel: (panelId: string | number | null) => {
    set({ selectedPanelId: panelId });
  },

  setIsEditingLayout: (isEditing: boolean) => {
    const state = get();
    
    if (isEditing && !state.isEditingLayout && state.dashboard) {
      // Entering edit mode: save collapsed states and expand all rows
      const collapsedStates = new Map<string | number, boolean>();
      let expandedDashboard = state.dashboard;
      
      state.dashboard.panels.forEach((panel) => {
        if (isRowPanel(panel) && panel.id) {
          collapsedStates.set(panel.id, panel.collapsed === true);
          // Expand collapsed rows
          if (panel.collapsed === true) {
            expandedDashboard = toggleRowCollapsed(expandedDashboard, panel.id, false);
          }
        }
      });
      
      set({
        isEditingLayout: true,
        chartLibraryOpen: false, // every edit session starts with the dock closed
        originalCollapsedStates: collapsedStates,
        dashboard: expandedDashboard,
      });
    } else if (!isEditing && state.isEditingLayout && state.dashboard) {
      // Exiting edit mode: restore collapsed states
      let restoredDashboard = state.dashboard;
      
      state.dashboard.panels.forEach((panel) => {
        if (isRowPanel(panel) && panel.id) {
          const originalCollapsed = state.originalCollapsedStates.get(panel.id);
          if (originalCollapsed !== undefined && originalCollapsed !== (panel.collapsed === true)) {
            // Restore original collapsed state
            restoredDashboard = toggleRowCollapsed(restoredDashboard, panel.id, originalCollapsed);
          }
        }
      });
      
      set({
        isEditingLayout: false,
        chartLibraryOpen: false,
        dashboard: restoredDashboard,
        originalCollapsedStates: new Map(),
      });
    } else {
      // Keep the dock from lingering open (and the toolbar shifted) when leaving edit mode
      set({ isEditingLayout: isEditing, ...(isEditing ? {} : { chartLibraryOpen: false }) });
    }
  },

  setChartLibraryOpen: (open: boolean) => {
    set({ chartLibraryOpen: open });
  },

  toggleChartLibrary: () => {
    set({ chartLibraryOpen: !get().chartLibraryOpen });
  },

  setOriginalCollapsedStates: (states: Map<string | number, boolean>) => {
    set({ originalCollapsedStates: states });
  },

  clearOriginalCollapsedStates: () => {
    set({ originalCollapsedStates: new Map() });
  },

  commit: (nextDashboard: Dashboard, previousDashboard: Dashboard) => {
    // Apply a user edit as a single undoable step: swap in the new dashboard AND record
    // the previous one on the undo stack in one atomic set(). This deliberately does NOT
    // route through setDashboard(), whose job is loading a fresh dashboard and which
    // therefore clears both stacks — running every edit through setDashboard is what
    // capped undo at a single step (each edit wiped the stack it had just grown).
    const state = get();
    const undoStack = [...state.undoStack, previousDashboard].slice(-state.maxUndoHistory);

    set({
      // Fresh object/array refs so Zustand and downstream memoized reads detect the change.
      dashboard: { ...nextDashboard, panels: [...nextDashboard.panels] },
      undoStack,
      redoStack: [], // Any new edit invalidates the redo history.
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
      // Drop a selection the reverted layout no longer contains so selectedPanelId
      // never points at a removed panel (DO-304 review follow-up).
      selectedPanelId:
        state.selectedPanelId !== null && !dashboardHasPanel(previousDashboard, state.selectedPanelId)
          ? null
          : state.selectedPanelId,
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
      // Symmetric with undo: drop a selection the redone layout no longer contains.
      selectedPanelId:
        state.selectedPanelId !== null && !dashboardHasPanel(nextDashboard, state.selectedPanelId)
          ? null
          : state.selectedPanelId,
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

