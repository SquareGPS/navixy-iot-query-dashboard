/**
 * Collision detection and resolution for dashboard panels
 */

import type { GridPos } from './grid';

export interface Rect extends GridPos {}

/**
 * Check if two rectangles overlap
 */
export function rectOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    b.x < a.x + a.w &&
    a.y < b.y + b.h &&
    b.y < a.y + a.h
  );
}

/**
 * Check if a rectangle overlaps with any panel in the list
 */
export function anyOverlap(rect: Rect, panels: Array<{ id: number; gridPos: GridPos }>, excludeId?: number): boolean {
  return panels.some(
    (panel) =>
      panel.id !== excludeId &&
      rectOverlap(rect, panel.gridPos)
  );
}

/**
 * Find all panels that overlap with the given rectangle
 */
export function findOverlappingPanels(
  rect: Rect,
  panels: Array<{ id: number; gridPos: GridPos }>,
  excludeId?: number
): Array<{ id: number; gridPos: GridPos }> {
  return panels.filter(
    (panel) =>
      panel.id !== excludeId &&
      rectOverlap(rect, panel.gridPos)
  );
}

/**
 * Resolve collisions by pushing overlapping panels down
 * Deterministic: resolves panels sorted by (y, x, id)
 * Returns new array with updated positions
 */
export function resolveCollisionsPushDown(
  moved: { id: number; gridPos: GridPos },
  panels: Array<{ id: number; gridPos: GridPos }>
): Array<{ id: number; gridPos: GridPos }> {
  const result = panels.map((p) => ({
    id: p.id,
    gridPos: { ...p.gridPos },
  }));

  // Find the moved panel and update its position
  const movedIndex = result.findIndex((p) => p.id === moved.id);
  if (movedIndex === -1) {
    return result;
  }

  result[movedIndex].gridPos = { ...moved.gridPos };

  // Sort panels by (y, x, id) for deterministic resolution order
  const sortedPanels = [...result].sort((a, b) => {
    if (a.gridPos.y !== b.gridPos.y) {
      return a.gridPos.y - b.gridPos.y;
    }
    if (a.gridPos.x !== b.gridPos.x) {
      return a.gridPos.x - b.gridPos.x;
    }
    return a.id - b.id;
  });

  let changed = true;
  const maxIterations = 100; // Prevent infinite loops
  let iterations = 0;

  // Iteratively resolve collisions until stable
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const panel of sortedPanels) {
      if (panel.id === moved.id) {
        continue; // Skip the moved panel itself
      }

      const overlaps = findOverlappingPanels(panel.gridPos, sortedPanels, panel.id);

      if (overlaps.length > 0) {
        // Find the lowest bottom edge among overlapping panels
        let lowestBottom = panel.gridPos.y;

        for (const overlap of overlaps) {
          const overlapBottom = overlap.gridPos.y + overlap.gridPos.h;
          if (overlapBottom > lowestBottom) {
            lowestBottom = overlapBottom;
          }
        }

        // Push this panel down
        const newY = lowestBottom;
        if (newY !== panel.gridPos.y) {
          panel.gridPos.y = newY;
          changed = true;
        }
      }
    }
  }

  return result;
}

