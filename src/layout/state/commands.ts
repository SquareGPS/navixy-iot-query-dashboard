/**
 * Command layer for dashboard operations
 * Wraps geometry functions and manages undo/redo
 */

import { useEditorStore } from './editorStore';
import { movePanel } from '../geometry/move';
import { applyResize, type ResizeHandle, type ResizeDelta } from '../geometry/resize';
import type { GrafanaDashboard } from '@/types/grafana-dashboard';

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

