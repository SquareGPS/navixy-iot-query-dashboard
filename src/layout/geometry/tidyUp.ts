/**
 * Tidy up dashboard layout:
 * - Remove empty vertical spaces
 * - Distribute horizontal space evenly between panels on the same row
 * - Fix overlapping elements by automatically repositioning them
 */

import type { Dashboard, Panel } from '@/types/dashboard-types';
import type { GridPos } from './grid';
import { GRID_COLUMNS } from './grid';
import { rectOverlap } from './collisions';
import { autoPack } from './autopack';
import { isRowPanel } from './rows';

/**
 * Group panels by their Y position (row)
 * Panels are considered on the same row if their Y positions overlap
 */
function groupPanelsByRow(
  panels: Array<{ id: number; gridPos: GridPos }>
): Array<Array<{ id: number; gridPos: GridPos }>> {
  const rows: Array<Array<{ id: number; gridPos: GridPos }>> = [];
  const processed = new Set<number>();

  for (const panel of panels) {
    if (processed.has(panel.id)) {
      continue;
    }

    // Find all panels that overlap vertically with this panel
    const rowPanels: Array<{ id: number; gridPos: GridPos }> = [panel];
    processed.add(panel.id);

    for (const other of panels) {
      if (processed.has(other.id)) {
        continue;
      }

      // Check if panels overlap vertically (same row)
      const verticalOverlap =
        panel.gridPos.y < other.gridPos.y + other.gridPos.h &&
        other.gridPos.y < panel.gridPos.y + panel.gridPos.h;

      if (verticalOverlap) {
        rowPanels.push(other);
        processed.add(other.id);
      }
    }

    rows.push(rowPanels);
  }

  // Sort rows by Y position
  rows.sort((a, b) => {
    const aMinY = Math.min(...a.map((p) => p.gridPos.y));
    const bMinY = Math.min(...b.map((p) => p.gridPos.y));
    return aMinY - bMinY;
  });

  return rows;
}

/**
 * Distribute panels evenly across the horizontal space
 * Preserves panel widths and heights, only adjusts X positions
 */
function distributePanelsEvenly(
  rowPanels: Array<{ id: number; gridPos: GridPos }>
): Array<{ id: number; gridPos: GridPos }> {
  if (rowPanels.length === 0) {
    return rowPanels;
  }

  // Sort panels by current X position
  const sorted = [...rowPanels].sort((a, b) => a.gridPos.x - b.gridPos.x);

  // Calculate total width of all panels
  const totalWidth = sorted.reduce((sum, p) => sum + p.gridPos.w, 0);

  // If panels exceed grid width, pack them tightly from left
  if (totalWidth > GRID_COLUMNS) {
    let x = 0;
    return sorted.map((panel) => {
      const newPos = { ...panel.gridPos, x };
      x += panel.gridPos.w;
      return { ...panel, gridPos: newPos };
    });
  }

  // Calculate spacing between panels
  const totalSpacing = GRID_COLUMNS - totalWidth;
  const spacing = rowPanels.length > 1 ? totalSpacing / (rowPanels.length - 1) : 0;

  // Distribute panels evenly
  let x = 0;
  return sorted.map((panel) => {
    const newPos = { ...panel.gridPos, x: Math.round(x) };
    x += panel.gridPos.w + spacing;
    return { ...panel, gridPos: newPos };
  });
}

/**
 * Resolve overlapping panels by repositioning them
 * Uses a simple approach: push overlapping panels down
 */
function resolveOverlaps(
  panels: Array<{ id: number; gridPos: GridPos }>
): Array<{ id: number; gridPos: GridPos }> {
  const result = panels.map((p) => ({
    id: p.id,
    gridPos: { ...p.gridPos },
  }));

  // Sort by Y, then X, then ID for deterministic processing
  const sorted = [...result].sort((a, b) => {
    if (a.gridPos.y !== b.gridPos.y) {
      return a.gridPos.y - b.gridPos.y;
    }
    if (a.gridPos.x !== b.gridPos.x) {
      return a.gridPos.x - b.gridPos.x;
    }
    return a.id - b.id;
  });

  // Check each panel against all others and resolve overlaps
  for (let i = 0; i < sorted.length; i++) {
    const panel = sorted[i];

    for (let j = i + 1; j < sorted.length; j++) {
      const other = sorted[j];

      if (rectOverlap(panel.gridPos, other.gridPos)) {
        // Push the second panel down
        const newY = panel.gridPos.y + panel.gridPos.h;
        other.gridPos.y = newY;
      }
    }
  }

  return result;
}

/**
 * Tidy up the dashboard layout
 * 
 * Process:
 * 1. Get all non-row panels (we don't reposition row headers)
 * 2. Resolve overlaps first
 * 3. Group panels by row (Y position)
 * 4. Distribute panels evenly within each row
 * 5. Auto-pack to remove empty vertical spaces
 */
export function tidyUp(dashboard: Dashboard): Dashboard {
  // Get all non-row panels
  const nonRowPanels = dashboard.panels
    .filter((p) => !isRowPanel(p) && p.id !== undefined)
    .map((p) => ({
      id: p.id!,
      gridPos: p.gridPos,
    }));

  if (nonRowPanels.length === 0) {
    return dashboard;
  }

  // Step 1: Resolve overlaps
  let tidiedPanels = resolveOverlaps(nonRowPanels);

  // Step 2: Group panels by row
  const rows = groupPanelsByRow(tidiedPanels);

  // Step 3: Distribute panels evenly within each row
  tidiedPanels = [];
  for (const rowPanels of rows) {
    const distributed = distributePanelsEvenly(rowPanels);
    tidiedPanels.push(...distributed);
  }

  // Step 4: Auto-pack to remove empty vertical spaces
  tidiedPanels = autoPack(tidiedPanels);

  // Step 5: Create updated dashboard with new positions
  const panelMap = new Map(tidiedPanels.map((p) => [p.id, p.gridPos]));

  const updatedPanels = dashboard.panels.map((panel) => {
    if (isRowPanel(panel) || panel.id === undefined) {
      return panel;
    }

    const newPos = panelMap.get(panel.id);
    if (newPos) {
      return {
        ...panel,
        gridPos: newPos,
      };
    }

    return panel;
  });

  return {
    ...dashboard,
    panels: updatedPanels,
  };
}

