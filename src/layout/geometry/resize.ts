/**
 * Resize geometry functions for panel resizing
 */

import type { GridPos } from './grid';
import { clampToBounds, GRID_COLUMNS } from './grid';
import { pixelsToGrid, gridToPixels, GRID_UNIT_HEIGHT } from './grid';
import { resolveCollisionsPushDown } from './collisions';
import type { GrafanaDashboard, GrafanaPanel } from '@/types/grafana-dashboard';

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface ResizeDelta {
  x: number; // pixel delta
  y: number; // pixel delta
}

/**
 * Minimum size constraints per panel type
 */
const MIN_BY_TYPE: Record<string, { w: number; h: number }> = {
  default: { w: 4, h: 4 },
  stat: { w: 3, h: 3 },
  barchart: { w: 6, h: 6 },
  piechart: { w: 6, h: 6 },
  table: { w: 12, h: 8 },
  text: { w: 6, h: 4 },
};

/**
 * Get minimum size for a panel type
 */
function getMinSize(panelType?: string): { w: number; h: number } {
  return MIN_BY_TYPE[panelType || ''] ?? MIN_BY_TYPE.default;
}

/**
 * Clamp width to valid bounds and minimum size
 */
function clampWidth(
  x: number,
  w: number,
  minW: number,
  containerWidth: number
): number {
  const maxW = GRID_COLUMNS - x;
  return Math.max(minW, Math.min(w, maxW));
}

/**
 * Clamp height to valid bounds and minimum size
 */
function clampHeight(h: number, minH: number): number {
  return Math.max(minH, h);
}

/**
 * Snap a pixel coordinate to grid
 */
function snapToGrid(
  px: number,
  containerWidth: number,
  isVertical: boolean
): number {
  if (isVertical) {
    return Math.round(px / GRID_UNIT_HEIGHT);
  } else {
    return Math.round((px / containerWidth) * GRID_COLUMNS);
  }
}

/**
 * Resize a rectangle from a specific handle
 * Returns the new rect with snapping, clamping, and min size applied
 */
export function resizeRectFromHandle(
  rect: GridPos,
  handle: ResizeHandle,
  delta: ResizeDelta,
  containerWidth: number,
  panelType?: string
): GridPos {
  const minSize = getMinSize(panelType);
  const { x, y, w, h } = rect;

  // Calculate current boundaries
  const right = x + w;
  const bottom = y + h;

  // Convert pixel deltas to grid deltas
  const gridDeltaX = snapToGrid(delta.x, containerWidth, false);
  const gridDeltaY = snapToGrid(delta.y, containerWidth, true);

  let newX = x;
  let newY = y;
  let newW = w;
  let newH = h;

  // Convert current boundaries to pixels for calculations
  const pxRight = (right / GRID_COLUMNS) * containerWidth;
  const pxBottom = bottom * GRID_UNIT_HEIGHT;
  const pxX = (x / GRID_COLUMNS) * containerWidth;
  const pxY = y * GRID_UNIT_HEIGHT;

  // Handle resize based on handle
  switch (handle) {
    case 'e': {
      // East: resize width only
      const newPxRight = pxRight + delta.x;
      const snappedRight = snapToGrid(newPxRight, containerWidth, false);
      newW = clampWidth(x, snappedRight - x, minSize.w, containerWidth);
      break;
    }
    case 'w': {
      // West: resize width and move x
      const newPxLeft = pxX + delta.x;
      const snappedLeft = snapToGrid(newPxLeft, containerWidth, false);
      newX = Math.max(0, snappedLeft);
      newW = clampWidth(newX, right - newX, minSize.w, containerWidth);
      // Adjust x if width constraint hit
      if (newW < minSize.w) {
        newX = Math.max(0, right - minSize.w);
        newW = minSize.w;
      }
      break;
    }
    case 's': {
      // South: resize height only
      const newPxBottom = pxBottom + delta.y;
      const snappedBottom = snapToGrid(newPxBottom, containerWidth, true);
      newH = clampHeight(snappedBottom - y, minSize.h);
      break;
    }
    case 'n': {
      // North: resize height and move y
      const newPxTop = pxY + delta.y;
      const snappedTop = snapToGrid(newPxTop, containerWidth, true);
      newY = Math.max(0, snappedTop);
      newH = clampHeight(bottom - newY, minSize.h);
      // Adjust y if height constraint hit
      if (newH < minSize.h) {
        newY = Math.max(0, bottom - minSize.h);
        newH = minSize.h;
      }
      break;
    }
    case 'ne': {
      // Northeast: resize width and height, move y
      const newPxRight = pxRight + delta.x;
      const newPxTop = pxY + delta.y;
      const snappedRight = snapToGrid(newPxRight, containerWidth, false);
      const snappedTop = snapToGrid(newPxTop, containerWidth, true);
      newY = Math.max(0, snappedTop);
      newW = clampWidth(x, snappedRight - x, minSize.w, containerWidth);
      newH = clampHeight(bottom - newY, minSize.h);
      if (newH < minSize.h) {
        newY = Math.max(0, bottom - minSize.h);
        newH = minSize.h;
      }
      break;
    }
    case 'nw': {
      // Northwest: resize width and height, move x and y
      const newPxLeft = pxX + delta.x;
      const newPxTop = pxY + delta.y;
      const snappedLeft = snapToGrid(newPxLeft, containerWidth, false);
      const snappedTop = snapToGrid(newPxTop, containerWidth, true);
      newX = Math.max(0, snappedLeft);
      newY = Math.max(0, snappedTop);
      newW = clampWidth(newX, right - newX, minSize.w, containerWidth);
      newH = clampHeight(bottom - newY, minSize.h);
      if (newW < minSize.w) {
        newX = Math.max(0, right - minSize.w);
        newW = minSize.w;
      }
      if (newH < minSize.h) {
        newY = Math.max(0, bottom - minSize.h);
        newH = minSize.h;
      }
      break;
    }
    case 'se': {
      // Southeast: resize width and height
      const newPxRight = pxRight + delta.x;
      const newPxBottom = pxBottom + delta.y;
      const snappedRight = snapToGrid(newPxRight, containerWidth, false);
      const snappedBottom = snapToGrid(newPxBottom, containerWidth, true);
      newW = clampWidth(x, snappedRight - x, minSize.w, containerWidth);
      newH = clampHeight(snappedBottom - y, minSize.h);
      break;
    }
    case 'sw': {
      // Southwest: resize width and height, move x
      const newPxLeft = pxX + delta.x;
      const newPxBottom = pxBottom + delta.y;
      const snappedLeft = snapToGrid(newPxLeft, containerWidth, false);
      const snappedBottom = snapToGrid(newPxBottom, containerWidth, true);
      newX = Math.max(0, snappedLeft);
      newW = clampWidth(newX, right - newX, minSize.w, containerWidth);
      newH = clampHeight(snappedBottom - y, minSize.h);
      if (newW < minSize.w) {
        newX = Math.max(0, right - minSize.w);
        newW = minSize.w;
      }
      break;
    }
  }

  // Ensure integers
  const result: GridPos = {
    x: Math.round(newX),
    y: Math.round(newY),
    w: Math.round(newW),
    h: Math.round(newH),
  };

  // Final clamp to bounds
  return clampToBounds(result);
}

/**
 * Resolve collisions after resize by pushing overlapping panels down
 * Similar to resolveCollisionsPushDown but specifically for resize operations
 */
export function resolveCollisionsAfterResize(
  resizedPanel: { id: number; gridPos: GridPos },
  panels: Array<{ id: number; gridPos: GridPos }>
): Array<{ id: number; gridPos: GridPos }> {
  return resolveCollisionsPushDown(resizedPanel, panels);
}

/**
 * Apply resize to a panel in a dashboard
 * Returns a new dashboard with the resized panel and resolved collisions
 */
export function applyResize(
  dashboard: GrafanaDashboard,
  panelId: number,
  handle: ResizeHandle,
  delta: ResizeDelta,
  containerWidth: number
): GrafanaDashboard {
  // Find the panel to resize
  const panelIndex = dashboard.panels.findIndex((p) => p.id === panelId);
  if (panelIndex === -1) {
    return dashboard; // Panel not found
  }

  const panel = dashboard.panels[panelIndex];

  // Resize the rect
  const resizedRect = resizeRectFromHandle(
    panel.gridPos,
    handle,
    delta,
    containerWidth,
    panel.type
  );

  // Create updated panels array
  const updatedPanels = dashboard.panels.map((p) =>
    p.id === panelId
      ? {
          ...p,
          gridPos: resizedRect,
        }
      : { ...p }
  );

  // Resolve collisions
  const afterCollisions = resolveCollisionsAfterResize(
    { id: panelId, gridPos: resizedRect },
    updatedPanels.map((p) => ({ id: p.id!, gridPos: p.gridPos }))
  );

  // Apply resolved positions back to panels
  const resultPanels = dashboard.panels.map((p) => {
    const resolved = afterCollisions.find((resolved) => resolved.id === p.id);
    if (resolved) {
      return {
        ...p,
        gridPos: resolved.gridPos,
      };
    }
    return p;
  });

  return {
    ...dashboard,
    panels: resultPanels,
  };
}

