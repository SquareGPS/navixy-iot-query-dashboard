/**
 * Panel addition geometry functions
 * Handles panel creation, ID generation, placement, and collision resolution
 */

import type { Dashboard, Panel } from '@/types/dashboard-types';
import type { GridPos } from './grid';
import { GRID_COLUMNS, clampToBounds } from './grid';
import { resolveCollisionsPushDown } from './collisions';
import { getRowHeaders, computeBands, isRowPanel, type RowPanel } from './rows';
import { idEq, idIncludes } from './idUtils';

/**
 * Visual defaults for panel types (safe seeds; extend later)
 */
export const DEFAULT_OPTIONS_BY_TYPE: Record<string, Partial<Panel>> = {
  stat: { options: { textMode: 'auto' } },
  barchart: { options: { orientation: 'vertical' } },
  bargauge: { options: { orientation: 'vertical' } },
  piechart: { options: { pieType: 'donut' } },
  table: { options: { showHeader: true } },
  text: { options: { mode: 'markdown', content: '' } },
};

/**
 * Recommended default sizes (grid units)
 */
export const DEFAULT_SIZE_BY_TYPE: Record<string, { w: number; h: number }> = {
  stat: { w: 6, h: 4 },
  barchart: { w: 12, h: 8 },
  bargauge: { w: 12, h: 8 },
  piechart: { w: 8, h: 8 },
  table: { w: 24, h: 8 },
  text: { w: 24, h: 4 },
  geomap: { w: 12, h: 10 },
};

/**
 * Minimum sizes (grid units) a panel type may occupy — the floor honoured both
 * on resize and, via clampSizeToMin, at creation time.
 */
export const MIN_BY_TYPE: Record<string, { w: number; h: number }> = {
  default: { w: 4, h: 4 },
  stat: { w: 3, h: 3 },
  barchart: { w: 6, h: 6 },
  bargauge: { w: 6, h: 6 },
  piechart: { w: 6, h: 6 },
  table: { w: 12, h: 8 },
  text: { w: 6, h: 4 },
};

/**
 * Clamp a requested panel size to valid creation bounds: never smaller than the
 * type's MIN_BY_TYPE floor, and never wider than the 24-column grid.
 *
 * Shared by placeNewPanel — so no creation path (gallery, duplicate, chart-library
 * drop) can seed a panel below its own resize-minimum (DO-317) — and by the
 * placement ghosts, so the preview the user positions matches the committed panel.
 * Idempotent: re-clamping an already-clamped size is a no-op.
 */
export function clampSizeToMin(
  panelType: string,
  size: { w: number; h: number }
): { w: number; h: number } {
  const min = MIN_BY_TYPE[panelType] ?? MIN_BY_TYPE.default;
  return {
    w: Math.max(min.w, Math.min(size.w, GRID_COLUMNS)),
    h: Math.max(min.h, size.h),
  };
}

/**
 * Get the next available panel ID
 * Returns 1 + max(id) across all panels (top-level + any row.panels)
 */
export function nextId(dashboard: Dashboard): string | number {
  const allIds = new Set<string | number>();

  function collectIds(panel: Panel) {
    if (panel.id !== undefined && panel.id !== null) {
      allIds.add(panel.id);
    }
    if (isRowPanel(panel) && panel.panels) {
      panel.panels.forEach(collectIds);
    }
  }

  dashboard.panels.forEach(collectIds);

  const numericIds = Array.from(allIds).filter((id): id is number => typeof id === 'number');
  const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
  return maxId + 1;
}

/**
 * Collect panels that participate in overlap checks within the destination scope
 * - Top: all top-level panels excluding collapsed rows' children
 * - Collapsed row: row.panels[]
 * - Expanded row: band children at top-level (between that row's header y and the next header's y)
 */
export function collectScopePanels(
  dashboard: Dashboard,
  target: 'top' | { rowId: string | number; state: 'collapsed' | 'expanded' }
): Array<{ id: string | number; gridPos: GridPos }> {
  if (target === 'top') {
    // Top-level: all panels excluding nested children of collapsed rows
    const collapsedRowChildIds = new Set<string | number>();
    for (const panel of dashboard.panels) {
      if (isRowPanel(panel) && panel.collapsed === true && panel.panels) {
        panel.panels.forEach((p) => {
          if (p.id !== undefined && p.id !== null) {
            collapsedRowChildIds.add(p.id);
          }
        });
      }
    }
    return dashboard.panels
      .filter((p) => p.id !== undefined && p.id !== null && !collapsedRowChildIds.has(p.id))
      .map((p) => ({ id: p.id!, gridPos: p.gridPos }));
  }

  const { rowId, state } = target;
  const row = dashboard.panels.find((p) => isRowPanel(p) && idEq(p.id, rowId)) as RowPanel | undefined;

  if (!row) return [];

  if (state === 'collapsed') {
    return (row.panels || [])
      .filter((p) => p.id !== undefined && p.id !== null)
      .map((p) => ({ id: p.id!, gridPos: p.gridPos }));
  } else {
    const bands = computeBands(dashboard.panels);
    const band = bands.find((b) => idEq(b.rowId, rowId));
    if (!band) return [];
    return dashboard.panels
      .filter((p) => p.id !== undefined && p.id !== null && idIncludes(band.childIds, p.id))
      .map((p) => ({ id: p.id!, gridPos: p.gridPos }));
  }
}

/**
 * Find first-fit position for a panel
 * Scans left→right, top→down for the first non-overlapping rectangle of {w,h}
 */
export function firstFit(
  scopePanels: Array<{ id: string | number; gridPos: GridPos }>,
  size: { w: number; h: number },
  minY: number = 0
): { x: number; y: number } {
  // Try positions starting from minY, going left to right, top to bottom
  for (let y = minY; y < minY + 100; y++) {
    for (let x = 0; x <= GRID_COLUMNS - size.w; x++) {
      const testRect: GridPos = { x, y, w: size.w, h: size.h };
      const overlaps = scopePanels.some(
        (p) =>
          p.gridPos.x < testRect.x + testRect.w &&
          testRect.x < p.gridPos.x + p.gridPos.w &&
          p.gridPos.y < testRect.y + testRect.h &&
          testRect.y < p.gridPos.y + p.gridPos.h
      );
      if (!overlaps) {
        return { x, y };
      }
    }
  }
  // Fallback: just below minY
  return { x: 0, y: minY };
}

/**
 * Place a new panel in the dashboard
 * spec: { type, title?, size?, target?: 'top' | { rowId, state }, hint?: { nearPanelId?: number } }
 */
export function placeNewPanel(
  dashboard: Dashboard,
  spec: {
    type: string;
    title?: string;
    size?: { w: number; h: number };
    target?: 'top' | { rowId: string | number; state: 'collapsed' | 'expanded' };
    hint?: { nearPanelId?: string | number; position?: { x: number; y: number } };
  }
): Dashboard {
  const target = spec.target || 'top';
  const panelType = spec.type;

  // Get default size for type
  const defaultSize = DEFAULT_SIZE_BY_TYPE[panelType] || DEFAULT_SIZE_BY_TYPE.stat;
  const size = spec.size || defaultSize;

  // Clamp to the type's minimum footprint and the 24-column grid, so a new panel
  // never starts smaller than its own resize-minimum (DO-317).
  const clampedSize = clampSizeToMin(panelType, size);

  // Generate new ID
  const newId = nextId(dashboard);

  // Get scope panels for collision detection
  const scopePanels = collectScopePanels(dashboard, target);

  // Determine initial position
  let initialPos: { x: number; y: number };

  if (spec.hint?.nearPanelId) {
    // Try to place near the specified panel
    const nearPanel = dashboard.panels.find((p) => idEq(p.id, spec.hint!.nearPanelId));
    if (nearPanel) {
      // Try to the right first
      const rightX = nearPanel.gridPos.x + nearPanel.gridPos.w;
      if (rightX + clampedSize.w <= GRID_COLUMNS) {
        initialPos = { x: rightX, y: nearPanel.gridPos.y };
      } else {
        // Try below
        initialPos = { x: nearPanel.gridPos.x, y: nearPanel.gridPos.y + nearPanel.gridPos.h };
      }
    } else {
      // Fallback to first-fit
      initialPos = firstFit(scopePanels, clampedSize);
    }
  } else if (spec.hint?.position) {
    // Direct position hint (from ghost placement)
    initialPos = spec.hint.position;
  } else {
    // Use first-fit
    let minY = 0;
    if (target !== 'top' && target.state === 'expanded') {
      // For expanded rows, start from the band top
      const bands = computeBands(dashboard.panels);
      const band = bands.find((b) => idEq(b.rowId, target.rowId));
      if (band) {
        minY = band.top;
      }
    }
    initialPos = firstFit(scopePanels, clampedSize, minY);
  }

  // Clamp position to bounds to ensure top-left corner stays within bounds (y >= 0, x >= 0)
  // This allows panels to be placed at y=0 (top of canvas) and below all rows
  const clampedPos = clampToBounds({ ...initialPos, ...clampedSize });

  // Create new panel with default options
  const defaultOptions = DEFAULT_OPTIONS_BY_TYPE[panelType] || {};
  const newPanel: Panel = {
    id: newId,
    type: panelType as Panel['type'],
    title: spec.title || `New ${panelType}`,
    gridPos: clampedPos,
    options: defaultOptions.options || {},
    fieldConfig: defaultOptions.fieldConfig,
    'x-navixy': {
      sql: { statement: '' },
      dataset: { shape: 'table', columns: {} },
    },
  };

  // Clone dashboard
  const newDashboard: Dashboard = {
    ...dashboard,
    panels: dashboard.panels.map((p) => ({ ...p })),
  };

  // Add panel to the appropriate location
  if (target === 'top') {
    // Add to top-level
    newDashboard.panels.push(newPanel);
  } else {
    const { rowId, state } = target;
    const row = newDashboard.panels.find((p) => isRowPanel(p) && idEq(p.id, rowId)) as RowPanel | undefined;

    if (!row) {
      // Row not found, fallback to top-level
      newDashboard.panels.push(newPanel);
    } else if (state === 'collapsed') {
      // Add to collapsed row's panels array
      if (!row.panels) {
        row.panels = [];
      }
      row.panels.push(newPanel);
    } else {
      // Add to expanded row's band (top-level)
      newDashboard.panels.push(newPanel);
    }
  }

  // Resolve collisions (push-down only, no global pack)
  const updatedScopePanels = collectScopePanels(newDashboard, target);
  const afterCollisions = resolveCollisionsPushDown(
    { id: newId, gridPos: newPanel.gridPos },
    updatedScopePanels
  );

  // Apply resolved positions
  if (target === 'top' || target.state === 'expanded') {
    // Update top-level panels
    afterCollisions.forEach((resolved) => {
      const idx = newDashboard.panels.findIndex((p) => idEq(p.id, resolved.id));
      if (idx !== -1) {
        newDashboard.panels[idx].gridPos = resolved.gridPos;
      }
    });
  } else {
    // Update collapsed row's panels
    const row = newDashboard.panels.find((p) => isRowPanel(p) && idEq(p.id, target.rowId)) as RowPanel | undefined;
    if (row && row.panels) {
      afterCollisions.forEach((resolved) => {
        const panel = row.panels!.find((p) => idEq(p.id, resolved.id));
        if (panel) {
          panel.gridPos = resolved.gridPos;
        }
      });
    }
  }

  return newDashboard;
}

