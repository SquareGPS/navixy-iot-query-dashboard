/**
 * Tidy up dashboard layout:
 * - Remove empty vertical spaces by moving rows up when there are gaps above them
 * 
 * This function identifies horizontal levels (rows) and removes empty vertical spaces
 * by moving elements below empty spaces upward.
 */

import type { Dashboard } from '@/types/dashboard-types';
import type { GridPos } from './grid';
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

  // Sort rows by minimum Y position
  rows.sort((a, b) => {
    const aMinY = Math.min(...a.map((p) => p.gridPos.y));
    const bMinY = Math.min(...b.map((p) => p.gridPos.y));
    return aMinY - bMinY;
  });

  return rows;
}

/**
 * Calculate the bottom Y position of a row (maximum y + h of all panels in the row)
 */
function getRowBottom(rowPanels: Array<{ id: number; gridPos: GridPos }>): number {
  if (rowPanels.length === 0) {
    return 0;
  }
  return Math.max(...rowPanels.map((p) => p.gridPos.y + p.gridPos.h));
}

/**
 * Calculate the top Y position of a row (minimum y of all panels in the row)
 */
function getRowTop(rowPanels: Array<{ id: number; gridPos: GridPos }>): number {
  if (rowPanels.length === 0) {
    return 0;
  }
  return Math.min(...rowPanels.map((p) => p.gridPos.y));
}

/**
 * Remove empty vertical spaces by moving rows up
 * 
 * Process:
 * 1. Group panels into rows (by overlapping Y positions)
 * 2. Sort rows by their top Y position
 * 3. Calculate cumulative offsets for each row based on gaps
 * 4. Apply offsets to move rows up and remove empty vertical spaces
 */
function removeEmptyVerticalSpaces(
  panels: Array<{ id: number; gridPos: GridPos }>
): Array<{ id: number; gridPos: GridPos }> {
  if (panels.length === 0) {
    return panels;
  }

  // Create a map for quick lookup with copies of panels
  const panelMap = new Map(panels.map((p) => [p.id, { ...p, gridPos: { ...p.gridPos } }]));
  const result = Array.from(panelMap.values());

  // Group panels into rows based on original positions
  const rows = groupPanelsByRow(panels);

  if (rows.length === 0) {
    return result;
  }

  // Calculate offsets for each row
  const rowOffsets: number[] = [];
  let cumulativeOffset = 0;

  for (let i = 0; i < rows.length; i++) {
    const currentRow = rows[i];
    const currentRowTop = getRowTop(currentRow);

    if (i === 0) {
      // First row: move it to Y=0 if it's not already there
      const gap = currentRowTop;
      if (gap > 0) {
        cumulativeOffset = -gap;
      }
    } else {
      // Subsequent rows: check for gap from previous row
      const previousRow = rows[i - 1];
      const previousRowBottom = getRowBottom(previousRow);
      const gap = currentRowTop - previousRowBottom;

      if (gap > 0) {
        // There's empty vertical space - accumulate the offset
        cumulativeOffset -= gap;
      }
    }

    rowOffsets.push(cumulativeOffset);
  }

  // Apply offsets to all panels
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const offset = rowOffsets[i];

    if (offset !== 0) {
      for (const panel of row) {
        const updatedPanel = panelMap.get(panel.id);
        if (updatedPanel) {
          updatedPanel.gridPos = {
            ...updatedPanel.gridPos,
            y: updatedPanel.gridPos.y + offset,
          };
        }
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
 * 2. Remove empty vertical spaces by moving rows up when there are gaps
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

  // Remove empty vertical spaces
  const tidiedPanels = removeEmptyVerticalSpaces(nonRowPanels);

  // Create updated dashboard with new positions
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

