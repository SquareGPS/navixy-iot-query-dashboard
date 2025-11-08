/**
 * Main movePanel function that orchestrates snapping, clamping, collision resolution, and auto-pack
 */

import type { Dashboard, Panel } from '@/types/dashboard-types';
import { clampToBounds } from './grid';
import { resolveCollisionsPushDown } from './collisions';
import { autoPack } from './autopack';

/**
 * Move a panel to a new position
 * Process:
 * 1. Snap to grid (x, y are already integers typically)
 * 2. Clamp to bounds
 * 3. Resolve collisions (push-down)
 * 4. Auto-pack (slide upward) - only if skipAutoPack is false
 * 
 * Returns a new dashboard object (immutable)
 * Idempotent: calling movePanel twice with same inputs yields identical output
 */
export function movePanel(
  dashboard: Dashboard,
  panelId: number,
  to: { x: number; y: number },
  skipAutoPack: boolean = false
): Dashboard {
  // Find the panel to move
  const panelIndex = dashboard.panels.findIndex((p) => p.id === panelId);
  if (panelIndex === -1) {
    return dashboard; // Panel not found, return unchanged
  }

  const panel = dashboard.panels[panelIndex];

  // Create a copy of the panel with new position
  const movedPanel: Panel = {
    ...panel,
    gridPos: {
      ...panel.gridPos,
      x: to.x,
      y: to.y,
    },
  };

  // Step 1: Snap to grid (ensure integers)
  let snappedPos = {
    x: Math.round(movedPanel.gridPos.x),
    y: Math.round(movedPanel.gridPos.y),
    w: movedPanel.gridPos.w,
    h: movedPanel.gridPos.h,
  };

  // Step 2: Clamp to bounds to ensure top-left corner stays within bounds (y >= 0, x >= 0)
  // This allows panels to be placed at y=0 (top of canvas) and below all rows
  snappedPos = clampToBounds(snappedPos);

  // Step 3: Create updated panels array with the moved panel
  const updatedPanels = dashboard.panels.map((p, idx) =>
    idx === panelIndex
      ? {
          ...p,
          gridPos: snappedPos,
        }
      : { ...p }
  );

  // Step 4: Resolve collisions
  const afterCollisions = resolveCollisionsPushDown(
    { id: panelId, gridPos: snappedPos },
    updatedPanels.map((p) => ({ id: p.id!, gridPos: p.gridPos }))
  );
  
  // Step 5: Auto-pack (skip during user drag operations to preserve exact drop position)
  let finalPositions = afterCollisions;
  if (!skipAutoPack) {
    const afterPack = autoPack(afterCollisions);
    finalPositions = afterPack;
  }

  // Step 6: Create new dashboard with updated panels
  const resultPanels = dashboard.panels.map((p) => {
    const packed = finalPositions.find((packed) => packed.id === p.id);
    if (packed) {
      return {
        ...p,
        gridPos: packed.gridPos,
      };
    }
    return p;
  });

  return {
    ...dashboard,
    panels: resultPanels,
  };
}

