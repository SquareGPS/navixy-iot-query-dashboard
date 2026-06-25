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
  normalizeDashboardLayout,
} from '../geometry/rows';
import { tidyUp } from '../geometry/tidyUp';
import { placeNewPanel, nextId } from '../geometry/add';
import { idEq } from '../geometry/idUtils';
import type { Dashboard, Panel } from '@/types/dashboard-types';
import type { ChartPresetPanel } from '@/types/chart-catalog';

/**
 * Command to move a panel
 * Updates the dashboard in the store and pushes to undo history
 */
export function cmdMovePanel(panelId: string | number, x: number, y: number): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    console.warn('cmdMovePanel: No dashboard in store');
    return;
  }

  // Get current dashboard state for undo
  const currentDashboard = store.dashboard;

  // Execute the move - skip autoPack during user drag operations to preserve exact drop position
  const newDashboard = movePanel(store.dashboard, panelId, { x, y }, true);

  // Update store
  store.setDashboard(newDashboard);
  
  // Push to history for undo
  store.pushToHistory(currentDashboard);
}

/**
 * Get the current dashboard from the store
 */
export function getDashboard(): Dashboard | null {
  return useEditorStore.getState().dashboard;
}

/**
 * Get the selected panel ID
 */
export function getSelectedPanelId(): string | number | null {
  return useEditorStore.getState().selectedPanelId;
}

/**
 * Set the selected panel
 */
export function setSelectedPanel(panelId: string | number | null): void {
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
 * Command to resize row band height
 * Updates the dashboard in the store and pushes to undo history
 * 
 * Note: This stores the explicit band height in `options.rowBandHeight` (grid units).
 * This is a custom extension to the Grafana JSON model - standard Grafana rows
 * extend their band to the next row or Infinity. We use this to allow explicit
 * control over row boundaries for better drop zone positioning.
 * 
 * Row panels maintain standard Grafana structure:
 * - `gridPos: {x: 0, y: variable, w: 24, h: 1}` (header height is always 1)
 * - Panels always have absolute `gridPos` coordinates
 * - Band height is stored in `options.rowBandHeight` (custom extension)
 */
export function cmdResizeRowHeight(
  rowId: string | number,
  deltaY: number
): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  // Get current dashboard state for undo
  const currentDashboard = store.dashboard;

  // Find the row
  const rowIndex = store.dashboard.panels.findIndex((p) => idEq(p.id, rowId) && p.type === 'row');
  if (rowIndex === -1) {
    return;
  }

  const row = store.dashboard.panels[rowIndex];
  const currentBandHeight = (row.options as { rowBandHeight?: number })?.rowBandHeight;
  
  // Calculate new band height in grid units
  // deltaY is in pixels, convert to grid units
  const GRID_UNIT_HEIGHT = 30; // From grid.ts
  const deltaGridUnits = Math.round(deltaY / GRID_UNIT_HEIGHT);
  
  // Minimum band height is 1 grid unit
  const newBandHeight = Math.max(1, (currentBandHeight ?? 0) + deltaGridUnits);

  // Create updated dashboard
  const newDashboard: Dashboard = {
    ...store.dashboard,
    panels: store.dashboard.panels.map((p, idx) => {
      if (idx === rowIndex) {
        return {
          ...p,
          options: {
            ...p.options,
            rowBandHeight: newBandHeight,
          },
        };
      }
      return p;
    }),
  };

  // Update store
  store.setDashboard(newDashboard);
  
  // Push to history for undo
  store.pushToHistory(currentDashboard);
}

/**
 * Command to resize a panel
 * Updates the dashboard in the store and pushes to undo history
 */
export function cmdResizePanel(
  panelId: string | number,
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
export function cmdToggleRowCollapsed(rowId: string | number, collapsed: boolean): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  // Prevent collapsing rows in edit mode
  if (store.isEditingLayout && collapsed) {
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
export function cmdMovePanelToRow(panelId: string | number, targetRowId: string | number | null, positionHint?: { x: number; y: number }): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    console.warn('cmdMovePanelToRow: No dashboard in store');
    return;
  }

  const currentDashboard = store.dashboard;
  
  let dashboardToUse = currentDashboard;

  // If in edit mode and targetRowId is provided, ensure the row is expanded
  if (store.isEditingLayout && targetRowId !== null) {
    const targetRow = dashboardToUse.panels.find(
      (p) => isRowPanel(p) && idEq(p.id, targetRowId)
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
export function cmdReorderRows(newRowIdOrder: Array<string | number>): void {
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
export function cmdMoveRow(rowId: string | number, newY: number): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    console.warn('cmdMoveRow: No dashboard in store');
    return;
  }

  const currentDashboard = store.dashboard;
  
  const newDashboard = moveRow(store.dashboard, rowId, newY);
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to delete a row
 */
export function cmdDeleteRow(rowId: string | number): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    console.warn('cmdDeleteRow: No dashboard in store');
    return;
  }

  const currentDashboard = store.dashboard;
  const newDashboard = deleteRow(store.dashboard, rowId);
  
  // Check if row was actually deleted by comparing panel counts
  const oldRowCount = currentDashboard.panels.filter((p) => isRowPanel(p) && idEq(p.id, rowId)).length;
  const newRowCount = newDashboard.panels.filter((p) => isRowPanel(p) && idEq(p.id, rowId)).length;
  
  if (oldRowCount === 0) {
    console.warn('cmdDeleteRow: Row not found');
    return;
  }
  
  if (oldRowCount === newRowCount) {
    console.warn('cmdDeleteRow: Row was not deleted');
    return;
  }
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to pack a row (auto-pack within row scope)
 */
export function cmdPackRow(rowId: string | number): void {
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
export function cmdRenameRow(rowId: string | number, newTitle: string): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const currentDashboard = store.dashboard;
  const rowIndex = currentDashboard.panels.findIndex((p) => isRowPanel(p) && idEq(p.id, rowId));
  
  if (rowIndex === -1) {
    return;
  }

  const newDashboard: Dashboard = {
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
  target?: 'top' | { rowId: string | number; state: 'collapsed' | 'expanded' };
  hint?: { nearPanelId?: string | number; position?: { x: number; y: number } };
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
 * Deep-clone a source panel's content (options / fieldConfig / x-navixy) onto a
 * freshly placed target panel. Shared by cmdDuplicatePanel and cmdAddPresetPanel.
 * Uses a JSON round-trip to match the cloning idiom used elsewhere in this module.
 */
function applyClonedContent(
  target: Panel,
  source: { options?: unknown; fieldConfig?: unknown; 'x-navixy'?: unknown }
): void {
  target.options = source.options ? JSON.parse(JSON.stringify(source.options)) : {};
  target.fieldConfig = source.fieldConfig ? JSON.parse(JSON.stringify(source.fieldConfig)) : undefined;
  if (source['x-navixy']) {
    target['x-navixy'] = JSON.parse(JSON.stringify(source['x-navixy']));
  }
}

/**
 * Effective grid footprint for a preset panel, applying the same 6×4 fallback the
 * drop uses. Shared with Canvas so the drag ghost and the committed panel never
 * diverge when a catalog row omits gridPos.w/h.
 */
export function getPresetSize(presetPanel: ChartPresetPanel): { w: number; h: number } {
  return {
    w: presetPanel.gridPos?.w ?? 6,
    h: presetPanel.gridPos?.h ?? 4,
  };
}

/**
 * Command to duplicate a panel
 * Creates a new panel with the same type/options/fieldConfig, positioned near the original
 * Handles both top-level panels and panels inside rows
 */
export function cmdDuplicatePanel(panelId: string | number): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    console.warn('cmdDuplicatePanel: No dashboard in store');
    return;
  }

  // Find the panel - check both top-level and inside rows
  let panel: Panel | undefined = store.dashboard.panels.find((p) => idEq(p.id, panelId));
  let panelInRowId: string | number | null = null;
  
  // If not found at top level, check inside rows
  if (!panel) {
    for (const p of store.dashboard.panels) {
      if (isRowPanel(p) && p.panels) {
        const rowPanel = p.panels.find((rp) => idEq(rp.id, panelId));
        if (rowPanel && p.id) {
          panel = rowPanel;
          panelInRowId = p.id;
          break;
        }
      }
    }
  }
  
  if (!panel) {
    console.warn('cmdDuplicatePanel: Panel not found');
    return;
  }

  // Determine target scope
  const scope = scopeOf(panelId, store.dashboard);
  const target = scope === 'top-level' ? 'top' : scope;

  // Calculate position for the duplicate panel
  // Try to place to the right of the original, or below if no space
  const GRID_COLUMNS = 24;
  let duplicateX = panel.gridPos.x + panel.gridPos.w;
  let duplicateY = panel.gridPos.y;
  
  // If placing to the right would overflow, place below instead
  if (duplicateX + panel.gridPos.w > GRID_COLUMNS) {
    duplicateX = panel.gridPos.x;
    duplicateY = panel.gridPos.y + panel.gridPos.h;
  }

  // Get next ID before placement (nextId is imported at the top of this module)
  const newId = nextId(store.dashboard);

  // Clone panel (new id, same type/options/fieldConfig)
  const currentDashboard = store.dashboard;
  const newDashboard = placeNewPanel(store.dashboard, {
    type: panel.type,
    title: `${panel.title} (Copy)`,
    size: { w: panel.gridPos.w, h: panel.gridPos.h },
    target,
    hint: { position: { x: duplicateX, y: duplicateY } },
  });

  // Find and update the newly created panel
  let newPanel: Panel | undefined;
  
  if (target === 'top') {
    newPanel = newDashboard.panels.find((p) => idEq(p.id, newId));
  } else {
    const row = newDashboard.panels.find((p) => p.type === 'row' && idEq(p.id, target.rowId));
    if (row && row.panels) {
      newPanel = row.panels.find((p: Panel) => idEq(p.id, newId));
    }
  }

  if (newPanel) {
    applyClonedContent(newPanel, panel);
  }

  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to add a Chart Library preset onto the dashboard (FR-11365).
 * Reuses placeNewPanel for geometry (fresh id, drop position, push-down collision
 * resolution), then deep-clones the preset's content (options / fieldConfig /
 * x-navixy) onto the new panel — same approach as cmdDuplicatePanel. Produces
 * exactly one undo entry, so Ctrl+Z removes the whole panel.
 */
export function cmdAddPresetPanel(
  presetPanel: ChartPresetPanel,
  position: { x: number; y: number }
): void {
  const store = useEditorStore.getState();

  if (!store.dashboard) {
    console.warn('cmdAddPresetPanel: No dashboard in store');
    return;
  }

  const currentDashboard = store.dashboard;
  const size = getPresetSize(presetPanel);

  // Geometry + new id (drop at cursor position, then resolve collisions push-down)
  const newId = nextId(currentDashboard);
  const newDashboard = placeNewPanel(currentDashboard, {
    type: presetPanel.type,
    title: presetPanel.title || 'Panel',
    size,
    target: 'top',
    hint: { position },
  });

  // Overwrite the freshly created panel with a deep clone of the preset's content
  const created = newDashboard.panels.find((p) => idEq(p.id, newId));
  if (created) {
    applyClonedContent(created, presetPanel);
  }

  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to tidy up the dashboard layout.
 * Applies type-aware panel placement (KPI rows, bar pairs, full-width tables/maps),
 * then canonicalizes rows and compacts vertical gaps (DO-279).
 */
export function cmdTidyUp(): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    return;
  }

  const currentDashboard = store.dashboard;
  const newDashboard = normalizeDashboardLayout(tidyUp(store.dashboard));

  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

/**
 * Command to delete a panel from the dashboard
 * Handles both top-level panels and panels inside rows
 */
export function cmdDeletePanel(panelId: string | number): void {
  const store = useEditorStore.getState();
  
  if (!store.dashboard) {
    console.warn('cmdDeletePanel: No dashboard in store');
    return;
  }

  const currentDashboard = store.dashboard;
  
  // Check if panel exists
  const panelIndex = currentDashboard.panels.findIndex((p) => idEq(p.id, panelId));
  
  // Also check if panel is inside a row
  let panelInRowId: string | number | null = null;
  if (panelIndex === -1) {
    // Panel not at top level - check inside rows
    for (const panel of currentDashboard.panels) {
      if (isRowPanel(panel) && panel.panels) {
        const rowPanelIndex = panel.panels.findIndex((p) => idEq(p.id, panelId));
        if (rowPanelIndex !== -1 && panel.id) {
          panelInRowId = panel.id;
          break;
        }
      }
    }
  }
  
  if (panelIndex === -1 && panelInRowId === null) {
    console.warn('cmdDeletePanel: Panel not found');
    return;
  }

  let newDashboard: Dashboard;
  
  if (panelIndex !== -1) {
    // Panel is at top level - remove directly
    newDashboard = {
      ...currentDashboard,
      panels: currentDashboard.panels.filter((p) => !idEq(p.id, panelId)),
    };
  } else {
    // Panel is inside a row - remove from row's panels array
    newDashboard = {
      ...currentDashboard,
      panels: currentDashboard.panels.map((p) => {
        if (isRowPanel(p) && idEq(p.id, panelInRowId) && p.panels) {
          return {
            ...p,
            panels: p.panels.filter((rp) => !idEq(rp.id, panelId)),
          };
        }
        return p;
      }),
    };
  }
  
  // Clear selection if the deleted panel was selected
  if (idEq(store.selectedPanelId, panelId)) {
    store.setSelectedPanel(null);
  }
  
  store.setDashboard(newDashboard);
  store.pushToHistory(currentDashboard);
}

