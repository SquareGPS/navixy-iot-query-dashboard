/**
 * Auto-pack panels by sliding them upward (negative gravity)
 * Preserves x, w, h; only modifies y
 */

import type { GridPos } from './grid';
import { rectOverlap } from './collisions';

/**
 * Auto-pack panels by sliding them upward while avoiding overlaps
 * Panels are processed in order (y, x, id) and each slides up until blocked
 */
export function autoPack(panels: Array<{ id: number; gridPos: GridPos }>): Array<{ id: number; gridPos: GridPos }> {
  const result = panels.map((p) => ({
    id: p.id,
    gridPos: { ...p.gridPos },
  }));

  // Sort by (y, x, id) for deterministic processing
  const sortedPanels = [...result].sort((a, b) => {
    if (a.gridPos.y !== b.gridPos.y) {
      return a.gridPos.y - b.gridPos.y;
    }
    if (a.gridPos.x !== b.gridPos.x) {
      return a.gridPos.x - b.gridPos.x;
    }
    return a.id - b.id;
  });

  // For each panel, try to slide it upward
  for (const panel of sortedPanels) {
    let newY = panel.gridPos.y;

    // Try decreasing y until we hit an obstacle or y becomes negative
    while (newY > 0) {
      const testPos: GridPos = {
        x: panel.gridPos.x,
        y: newY - 1,
        w: panel.gridPos.w,
        h: panel.gridPos.h,
      };

      // Check if this position would overlap with any other panel
      const wouldOverlap = sortedPanels.some(
        (other) =>
          other.id !== panel.id &&
          rectOverlap(testPos, other.gridPos)
      );

      if (wouldOverlap) {
        break; // Can't move further up
      }

      newY--;
    }

    panel.gridPos.y = newY;
  }

  return result;
}

