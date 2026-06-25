/**
 * Tidy up dashboard layout with type-aware elegant placement:
 * - Indicators in balanced rows (max 5), bar charts max 2/row, tables/maps full width
 * - Sections between row headers are laid out independently
 */

import type { Dashboard, Panel } from '@/types/dashboard-types';
import type { GridPos } from './grid';
import { GRID_COLUMNS } from './grid';
import { isRowPanel, getRowHeaders, computeBands } from './rows';
import { idEq } from './idUtils';
import {
  layoutPanelsElegantly,
  sectionBottomY,
  type LayoutablePanel,
} from './elegantLayout';

function toLayoutable(panel: Panel): LayoutablePanel | null {
  if (panel.id === undefined || panel.id === null) return null;
  return {
    id: panel.id,
    type: panel.type,
    gridPos: { ...panel.gridPos },
  };
}

function shiftLayouted(
  panels: LayoutablePanel[],
  yOffset: number
): Map<string, GridPos> {
  const map = new Map<string, GridPos>();
  for (const p of panels) {
    map.set(String(p.id), {
      ...p.gridPos,
      y: p.gridPos.y + yOffset,
    });
  }
  return map;
}

function layoutFlatPanels(panels: Panel[]): Map<string, GridPos> {
  const layoutable = panels
    .filter((p) => !isRowPanel(p))
    .map(toLayoutable)
    .filter((p): p is LayoutablePanel => p !== null);

  if (layoutable.length === 0) return new Map();

  const placed = layoutPanelsElegantly(layoutable);
  return shiftLayouted(placed, 0);
}

function layoutWithRowHeaders(panels: Panel[]): Map<string, GridPos> {
  const positionMap = new Map<string, GridPos>();
  const rowHeaders = getRowHeaders(panels).filter((r) => r.collapsed !== true);
  const bands = computeBands(panels);

  let yCursor = 0;

  const firstRowY = rowHeaders[0]?.gridPos.y ?? Infinity;
  const aboveFirst = panels.filter(
    (p) =>
      !isRowPanel(p) &&
      p.id !== undefined &&
      p.gridPos.y < firstRowY
  );

  if (aboveFirst.length > 0) {
    const layoutable = aboveFirst
      .map(toLayoutable)
      .filter((p): p is LayoutablePanel => p !== null);
    const placed = layoutPanelsElegantly(layoutable);
    const shifted = shiftLayouted(placed, yCursor);
    shifted.forEach((pos, id) => positionMap.set(id, pos));
    yCursor = sectionBottomY(placed) + yCursor;
  }

  for (const row of rowHeaders) {
    if (row.id === undefined) continue;

    const rowH = row.gridPos.h > 0 ? row.gridPos.h : 1;
    positionMap.set(String(row.id), {
      x: 0,
      y: yCursor,
      w: GRID_COLUMNS,
      h: rowH,
    });
    yCursor += rowH;

    const band = bands.find((b) => idEq(b.rowId, row.id));
    const bandPanels = band
      ? panels.filter(
          (p) =>
            !isRowPanel(p) &&
            p.id !== undefined &&
            band.childIds.some((id) => idEq(id, p.id!))
        )
      : [];

    if (bandPanels.length > 0) {
      const layoutable = bandPanels
        .map(toLayoutable)
        .filter((p): p is LayoutablePanel => p !== null);
      const placed = layoutPanelsElegantly(layoutable);
      const shifted = shiftLayouted(placed, yCursor);
      shifted.forEach((pos, id) => positionMap.set(id, pos));
      yCursor = sectionBottomY(placed) + yCursor;
    }
  }

  const trailing = panels.filter(
    (p) =>
      !isRowPanel(p) &&
      p.id !== undefined &&
      !positionMap.has(String(p.id))
  );

  if (trailing.length > 0) {
    const layoutable = trailing
      .map(toLayoutable)
      .filter((p): p is LayoutablePanel => p !== null);
    const placed = layoutPanelsElegantly(layoutable);
    const shifted = shiftLayouted(placed, yCursor);
    shifted.forEach((pos, id) => positionMap.set(id, pos));
  }

  return positionMap;
}

/**
 * Tidy up the dashboard layout with elegant type-aware placement.
 */
export function tidyUp(dashboard: Dashboard): Dashboard {
  const hasExpandedRows = getRowHeaders(dashboard.panels).some(
    (r) => r.collapsed !== true
  );

  const positionMap = hasExpandedRows
    ? layoutWithRowHeaders(dashboard.panels)
    : layoutFlatPanels(dashboard.panels);

  if (positionMap.size === 0) {
    return dashboard;
  }

  const updatedPanels = dashboard.panels.map((panel) => {
    if (panel.id === undefined) return panel;

    const newPos = positionMap.get(String(panel.id));
    if (newPos) {
      return { ...panel, gridPos: newPos };
    }

    return panel;
  });

  return {
    ...dashboard,
    panels: updatedPanels,
  };
}
