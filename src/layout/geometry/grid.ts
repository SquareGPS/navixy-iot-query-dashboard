/**
 * Grid utilities for Grafana's 24-column grid system
 */

export const GRID_COLUMNS = 24;
export const GRID_UNIT_HEIGHT = 30; // pixels per grid unit height

export interface GridPos {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Snap a pixel position to grid coordinates
 */
export function snapToGrid(x: number, y: number, gridSize: number = 1): { x: number; y: number } {
  return {
    x: Math.round(x / gridSize),
    y: Math.round(y / gridSize),
  };
}

/**
 * Clamp grid position to valid bounds
 * - x must be >= 0 and x + w <= 24
 * - y must be >= 0
 * - w and h must be > 0 (preserved from input)
 */
export function clampToBounds(pos: GridPos): GridPos {
  return {
    x: Math.max(0, Math.min(pos.x, GRID_COLUMNS - pos.w)),
    y: Math.max(0, pos.y),
    w: pos.w,
    h: pos.h,
  };
}

/**
 * Convert pixel coordinates to grid coordinates
 */
export function pixelsToGrid(
  px: number,
  py: number,
  containerWidth: number,
  gridUnitHeight: number = GRID_UNIT_HEIGHT
): { x: number; y: number } {
  const gridX = Math.round((px / containerWidth) * GRID_COLUMNS);
  const gridY = Math.round(py / gridUnitHeight);
  return {
    x: Math.max(0, Math.min(gridX, GRID_COLUMNS - 1)),
    y: Math.max(0, gridY),
  };
}

/**
 * Convert grid coordinates to pixel coordinates
 */
export function gridToPixels(
  gridX: number,
  gridY: number,
  containerWidth: number,
  gridUnitHeight: number = GRID_UNIT_HEIGHT
): { x: number; y: number } {
  return {
    x: (gridX / GRID_COLUMNS) * containerWidth,
    y: gridY * gridUnitHeight,
  };
}

