/**
 * Command layer for dashboard operations
 * Wraps geometry functions and manages undo/redo
 */

import { useEditorStore } from './editorStore';
import { movePanel } from '../geometry/move';
import { applyResize, type ResizeHandle, type ResizeDelta } from '../geometry/resize';
import {
  createRow,
  toggleRowCollapsed,
  movePanelToRow,
  reorderRows,
  canonicalizeRows,
  packRow,
  scopeOf,
  moveRow,
  deleteRow,
  isRowPanel,
} from '../geometry/rows';
import { placeNewPanel } from '../geometry/add';
import type { GrafanaDashboard, GrafanaPanel } from '@/types/grafana-dashboard';

/**
 * Command to move a panel
 * Updates the dashboard in the store and pushes to undo history
 */
export function cmdMovePanel(panelId: number, x: number, y: number): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  // Get current dashboard state for undo
  const currentDashboard = store.dashboard;

  // Execute the move
  const newDashboard = movePanel(store.dashboard, panelId, { x, y });

  // Update store
  store.setDashboard(newDashboard);
  
  // Push to history for undo
  store.pushToHistory(currentDashboard);
}

/**
 * Get the current dashboard from the store
 */
export function getDashboard(): GrafanaDashboard | null {
  return useEditorStore.getState().dashboard;
}

/**
 * Get the selected panel ID
 */
export function getSelectedPanelId(): number | null {
  return useEditorStore.getState().selectedPanelId;
}

/**
 * Set the selected panel
 */
export function setSelectedPanel(panelId: number | null): void {
  useEditorStore.getState().setSelectedPanel(panelId);
}

/**
 * Check if layout editing is enabled
 */
export function isEditingLayout(): boolean {
  return useEditorStore.getState().isEditingLayout;
}

/**
 * Toggle layout editing mode
 */
export function toggleLayoutEditing(): void {
  const store = useEditorStore.getState();
  store.setIsEditingLayout(!store.isEditingLayout);
}

/**
 * Command to resize a panel
 * Updates the dashboard in the store and pushes to undo history
 */
export function cmdResizePanel(
  panelId: number,
  handle: ResizeHandle,
  delta: ResizeDelta,
  containerWidth: number
): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  // Get current dashboard state for undo
  const currentDashboard = store.dashboard;

  // Execute the resize
  const newDashboard = applyResize(store.dashboard, panelId, handle, delta, containerWidth);

  // Update store
  store.setDashboard(newDashboard);
  
  // Push to history for undo
  store.pushToHistory(currentDashboard);
}

/**
 * Command to add a new row
 */
export function cmdAddRow(insertY: number, title: string = 'New row'): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const currentDashboard = store.dashboard;
  const newDashboard = createRow(store.dashboard, insertY, title);
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to toggle row collapsed state
 */
export function cmdToggleRowCollapsed(rowId: number, collapsed: boolean): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const currentDashboard = store.dashboard;
  const newDashboard = toggleRowCollapsed(store.dashboard, rowId, collapsed);
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to move a panel to a row (or top-level if targetRowId is null)
 * Ensures the target row is expanded if in edit mode
 */
export function cmdMovePanelToRow(panelId: number, targetRowId: number | null, positionHint?: { x: number; y: number }): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const currentDashboard = store.dashboard;
  let dashboardToUse = currentDashboard;

  // If in edit mode and targetRowId is provided, ensure the row is expanded
  if (store.isEditingLayout && targetRowId !== null) {
    const targetRow = dashboardToUse.panels.find(
      (p) => isRowPanel(p) && p.id === targetRowId
    );
    if (targetRow && targetRow.collapsed === true) {
      // Expand the row first
      dashboardToUse = toggleRowCollapsed(dashboardToUse, targetRowId, false);
    }
  }

  const newDashboard = movePanelToRow(dashboardToUse, panelId, targetRowId, positionHint);
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to reorder rows
 */
export function cmdReorderRows(newRowIdOrder: number[]): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const currentDashboard = store.dashboard;
  const newDashboard = reorderRows(store.dashboard, newRowIdOrder);
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to move a row to a new Y position
 */
export function cmdMoveRow(rowId: number, newY: number): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    console.warn('cmdMoveRow: No dashboard in store');
    return;
  }

  console.log('cmdMoveRow: Moving row', rowId, 'to Y position', newY);
  const currentDashboard = store.dashboard;
  const rowBefore = currentDashboard.panels.find((p) => isRowPanel(p) && p.id === rowId);
  console.log('cmdMoveRow: Row before move:', rowBefore?.gridPos);
  
  const newDashboard = moveRow(store.dashboard, rowId, newY);
  
  const rowAfter = newDashboard.panels.find((p) => isRowPanel(p) && p.id === rowId);
  console.log('cmdMoveRow: Row after move:', rowAfter?.gridPos);
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to delete a row
 */
export function cmdDeleteRow(rowId: number): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    console.warn('cmdDeleteRow: No dashboard in store');
    return;
  }

  console.log('cmdDeleteRow: Deleting row', rowId);
  const currentDashboard = store.dashboard;
  const newDashboard = deleteRow(store.dashboard, rowId);
  
  // Check if row was actually deleted by comparing panel counts
  const oldRowCount = currentDashboard.panels.filter((p) => isRowPanel(p) && p.id === rowId).length;
  const newRowCount = newDashboard.panels.filter((p) => isRowPanel(p) && p.id === rowId).length;
  
  if (oldRowCount === 0) {
    console.warn('cmdDeleteRow: Row not found');
    return;
  }
  
  if (oldRowCount === newRowCount) {
    console.warn('cmdDeleteRow: Row was not deleted');
    return;
  }
  
  console.log('cmdDeleteRow: Setting new dashboard. Old panels:', currentDashboard.panels.length, 'New panels:', newDashboard.panels.length);
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to pack a row (auto-pack within row scope)
 */
export function cmdPackRow(rowId: number): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const currentDashboard = store.dashboard;
  const newDashboard = packRow(store.dashboard, rowId);
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to rename a row
 */
export function cmdRenameRow(rowId: number, newTitle: string): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const currentDashboard = store.dashboard;
  const rowIndex = currentDashboard.panels.findIndex((p) => isRowPanel(p) && p.id === rowId);
  
  if (rowIndex === -1) {
    return;
  }

  const newDashboard: GrafanaDashboard = {
    ...currentDashboard,
    panels: currentDashboard.panels.map((p, idx) => 
      idx === rowIndex ? { ...p, title: newTitle } : p
    ),
  };
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Canonicalize rows (call before saving)
 */
export function cmdCanonicalizeRows(): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const newDashboard = canonicalizeRows(store.dashboard);
  store.setDashboard(newDashboard);
}

/**
 * Command to add a new panel
 * spec: { type, title?, size?, target?: 'top' | { rowId, state }, hint?: { nearPanelId?: number } }
 */
export function cmdAddPanel(spec: {
  type: string;
  title?: string;
  size?: { w: number; h: number };
  target?: 'top' | { rowId: number; state: 'collapsed' | 'expanded' };
  hint?: { nearPanelId?: number; position?: { x: number; y: number } };
}): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const currentDashboard = store.dashboard;
  const newDashboard = placeNewPanel(store.dashboard, spec);
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to duplicate a panel
 * Creates a new panel with the same type/options/fieldConfig, positioned near the original
 */
export function cmdDuplicatePanel(panelId: number): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const panel = store.dashboard.panels.find((p) => p.id === panelId);
  if (!panel) {
    return;
  }

  // Determine target scope
  const scope = scopeOf(panelId, store.dashboard);
  const target = scope === 'top-level' ? 'top' : scope;

  // Get next ID before placement
  const { nextId } = require('../geometry/add');
  const newId = nextId(store.dashboard);

  // Clone panel (new id, same type/options/fieldConfig)
  const currentDashboard = store.dashboard;
  const newDashboard = placeNewPanel(store.dashboard, {
    type: panel.type,
    title: `${panel.title} (Copy)`,
    size: { w: panel.gridPos.w, h: panel.gridPos.h },
    target,
    hint: { nearPanelId: panelId },
  });

  // Find and update the newly created panel
  let newPanel: GrafanaPanel | undefined;
  
  if (target === 'top') {
    newPanel = newDashboard.panels.find((p) => p.id === newId);
  } else {
    const row = newDashboard.panels.find((p) => p.type === 'row' && p.id === target.rowId) as any;
    if (row && row.panels) {
      newPanel = row.panels.find((p: GrafanaPanel) => p.id === newId);
    }
  }

  if (newPanel) {
    // Deep copy options and fieldConfig
    newPanel.options = panel.options ? JSON.parse(JSON.stringify(panel.options)) : {};
    newPanel.fieldConfig = panel.fieldConfig ? JSON.parse(JSON.stringify(panel.fieldConfig)) : undefined;
    if (panel['x-navixy']) {
      newPanel['x-navixy'] = JSON.parse(JSON.stringify(panel['x-navixy']));
    }
  }

  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

