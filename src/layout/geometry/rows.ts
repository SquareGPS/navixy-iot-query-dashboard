/**
 * Row geometry functions for Grafana-compatible row operations
 */

import type { GrafanaDashboard, GrafanaPanel } from '@/types/grafana-dashboard';
import type { GridPos } from './grid';
import { clampToBounds, GRID_COLUMNS } from './grid';
import { resolveCollisionsPushDown } from './collisions';
import { autoPack } from './autopack';
import { pixelsToGrid } from './grid';

/**
 * Extended panel type that includes row-specific fields
 */
export interface RowPanel extends GrafanaPanel {
  type: 'row';
  collapsed?: boolean;
  panels?: GrafanaPanel[];
}

/**
 * Check if a panel is a row
 */
export function isRowPanel(panel: GrafanaPanel): panel is RowPanel {
  return panel.type === 'row';
}

/**
 * Get all row headers from top-level panels, sorted by (y, x, id)
 */
export function getRowHeaders(panels: GrafanaPanel[]): RowPanel[] {
  return panels
    .filter(isRowPanel)
    .sort((a, b) => {
      if (a.gridPos.y !== b.gridPos.y) {
        return a.gridPos.y - b.gridPos.y;
      }
      if (a.gridPos.x !== b.gridPos.x) {
        return a.gridPos.x - b.gridPos.x;
      }
      return (a.id || 0) - (b.id || 0);
    });
}

/**
 * Band represents the space between two row headers
 */
export interface Band {
  rowId: number;
  top: number;
  bottom: number;
  childIds: number[];
}

/**
 * Compute bands for all expanded rows
 */
export function computeBands(panels: GrafanaPanel[]): Band[] {
  const rowHeaders = getRowHeaders(panels);
  const bands: Band[] = [];

  for (let i = 0; i < rowHeaders.length; i++) {
    const row = rowHeaders[i];
    const nextRow = rowHeaders[i + 1];
    
    if (row.collapsed !== false) {
      continue; // Skip collapsed rows
    }

    const top = row.gridPos.y + 1; // Band starts below row header
    const bottom = nextRow ? nextRow.gridPos.y : Infinity;

    // Find all top-level panels that fall within this band
    const childIds = panels
      .filter((p) => {
        if (isRowPanel(p)) return false;
        const y = p.gridPos.y;
        return y >= top && y < bottom;
      })
      .map((p) => p.id!)
      .filter((id): id is number => id !== undefined);

    bands.push({
      rowId: row.id!,
      top,
      bottom,
      childIds,
    });
  }

  return bands;
}

/**
 * Determine the scope of a panel
 */
export function scopeOf(
  panelId: number,
  dashboard: GrafanaDashboard
): 'top-level' | { rowId: number; state: 'collapsed' | 'expanded' } {
  // Check if panel is in any collapsed row's panels array
  for (const panel of dashboard.panels) {
    if (isRowPanel(panel) && panel.collapsed === true && panel.panels) {
      if (panel.panels.some((p) => p.id === panelId)) {
        return { rowId: panel.id!, state: 'collapsed' };
      }
    }
  }

  // Check if panel is in an expanded row's band
  const bands = computeBands(dashboard.panels);
  for (const band of bands) {
    if (band.childIds.includes(panelId)) {
      return { rowId: band.rowId, state: 'expanded' };
    }
  }

  return 'top-level';
}

/**
 * Get panels in a specific scope
 */
function getScopePanels(
  dashboard: GrafanaDashboard,
  scope: 'top-level' | { rowId: number; state: 'collapsed' | 'expanded' }
): Array<{ id: number; gridPos: GridPos }> {
  if (scope === 'top-level') {
    // Return all top-level panels excluding nested children of collapsed rows
    const collapsedRowChildIds = new Set<number>();
    for (const panel of dashboard.panels) {
      if (isRowPanel(panel) && panel.collapsed === true && panel.panels) {
        panel.panels.forEach((p) => {
          if (p.id) collapsedRowChildIds.add(p.id);
        });
      }
    }
    return dashboard.panels
      .filter((p) => p.id && !collapsedRowChildIds.has(p.id))
      .map((p) => ({ id: p.id!, gridPos: p.gridPos }));
  }

  const { rowId, state } = scope;
  const row = dashboard.panels.find((p) => isRowPanel(p) && p.id === rowId) as RowPanel | undefined;
  
  if (!row) return [];

  if (state === 'collapsed') {
    // Return panels from row.panels[]
    return (row.panels || [])
      .filter((p) => p.id)
      .map((p) => ({ id: p.id!, gridPos: p.gridPos }));
  } else {
    // Return panels from top-level within the band
    const band = computeBands(dashboard.panels).find((b) => b.rowId === rowId);
    if (!band) return [];
    return dashboard.panels
      .filter((p) => p.id && band.childIds.includes(p.id))
      .map((p) => ({ id: p.id!, gridPos: p.gridPos }));
  }
}

/**
 * Find first-fit position for a panel in a scope
 */
function firstFit(
  scopePanels: Array<{ id: number; gridPos: GridPos }>,
  size: { w: number; h: number },
  excludeId?: number,
  minY: number = 0
): { x: number; y: number } {
  // Try positions starting from minY, going left to right, top to bottom
  for (let y = minY; y < minY + 100; y++) {
    for (let x = 0; x <= GRID_COLUMNS - size.w; x++) {
      const testRect: GridPos = { x, y, w: size.w, h: size.h };
      const overlaps = scopePanels.some(
        (p) => p.id !== excludeId && 
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
 * Move a panel to a row (or top-level if targetRowId is null)
 */
export function movePanelToRow(
  dashboard: GrafanaDashboard,
  panelId: number,
  targetRowId: number | null
): GrafanaDashboard {
  const panelIndex = dashboard.panels.findIndex((p) => p.id === panelId);
  if (panelIndex === -1) {
    return dashboard;
  }

  const panel = dashboard.panels[panelIndex];
  const currentScope = scopeOf(panelId, dashboard);

  // Clone dashboard
  const newDashboard: GrafanaDashboard = {
    ...dashboard,
    panels: dashboard.panels.map((p) => ({ ...p })),
  };

  // Remove panel from current scope
  if (currentScope === 'top-level') {
    // Already at top-level, just update position if needed
  } else {
    // Remove from row.panels if collapsed
    const currentRow = newDashboard.panels.find(
      (p) => isRowPanel(p) && p.id === currentScope.rowId
    ) as RowPanel | undefined;
    if (currentRow && currentRow.collapsed === true && currentRow.panels) {
      currentRow.panels = currentRow.panels.filter((p) => p.id !== panelId);
    }
  }

  // Add panel to target scope
  if (targetRowId === null) {
    // Move to top-level
    const panelPos = panel.gridPos;
    const scopePanels = getScopePanels(newDashboard, 'top-level').filter((p) => p.id !== panelId);
    const newPos = firstFit(scopePanels, { w: panelPos.w, h: panelPos.h }, panelId);
    
    newDashboard.panels[panelIndex].gridPos = { ...panelPos, ...newPos };
    
    // Resolve collisions
    const afterCollisions = resolveCollisionsPushDown(
      { id: panelId, gridPos: newDashboard.panels[panelIndex].gridPos },
      getScopePanels(newDashboard, 'top-level')
    );
    
    // Apply resolved positions
    afterCollisions.forEach((resolved) => {
      const idx = newDashboard.panels.findIndex((p) => p.id === resolved.id);
      if (idx !== -1) {
        newDashboard.panels[idx].gridPos = resolved.gridPos;
      }
    });
  } else {
    const targetRow = newDashboard.panels.find(
      (p) => isRowPanel(p) && p.id === targetRowId
    ) as RowPanel | undefined;
    
    if (!targetRow) {
      return dashboard;
    }

    if (targetRow.collapsed === true) {
      // Move to collapsed row's panels array
      // Panels in collapsed rows use RELATIVE Y coordinates
      if (!targetRow.panels) {
        targetRow.panels = [];
      }
      
      const scopePanels = getScopePanels(newDashboard, { rowId: targetRowId, state: 'collapsed' });
      const panelPos = panel.gridPos;
      
      // Convert absolute Y to relative Y for collapsed row scope
      const rowY = targetRow.gridPos.y;
      const bandTop = rowY + 1;
      const relativePanelPos = {
        ...panelPos,
        y: panelPos.y - bandTop, // Convert to relative
      };
      
      // Find position in relative coordinate space (minY=0 for collapsed rows)
      const newPos = firstFit(scopePanels, { w: panelPos.w, h: panelPos.h }, panelId, 0);
      
      const newPanel: GrafanaPanel = {
        ...panel,
        gridPos: { ...relativePanelPos, ...newPos }, // Use relative coordinates
      };
      
      targetRow.panels.push(newPanel);
      
      // Remove from top-level
      newDashboard.panels = newDashboard.panels.filter((p) => p.id !== panelId);
      
      // Resolve collisions in row scope (all in relative coordinates)
      const afterCollisions = resolveCollisionsPushDown(
        { id: panelId, gridPos: newPos },
        getScopePanels(newDashboard, { rowId: targetRowId, state: 'collapsed' })
      );
      
      // Apply resolved positions (all relative)
      afterCollisions.forEach((resolved) => {
        const rowPanel = targetRow.panels!.find((p) => p.id === resolved.id);
        if (rowPanel) {
          rowPanel.gridPos = resolved.gridPos;
        }
      });
    } else {
      // Move to expanded row's band (top-level)
      const band = computeBands(newDashboard.panels).find((b) => b.rowId === targetRowId);
      if (!band) {
        return dashboard;
      }

      const minY = band.top;
      const scopePanels = getScopePanels(newDashboard, { rowId: targetRowId, state: 'expanded' }).filter(
        (p) => p.id !== panelId
      );
      const panelPos = panel.gridPos;
      const newPos = firstFit(scopePanels, { w: panelPos.w, h: panelPos.h }, panelId, minY);
      
      newDashboard.panels[panelIndex].gridPos = { ...panelPos, ...newPos };
      
      // Resolve collisions in top-level scope
      const afterCollisions = resolveCollisionsPushDown(
        { id: panelId, gridPos: newDashboard.panels[panelIndex].gridPos },
        getScopePanels(newDashboard, 'top-level')
      );
      
      // Apply resolved positions
      afterCollisions.forEach((resolved) => {
        const idx = newDashboard.panels.findIndex((p) => p.id === resolved.id);
        if (idx !== -1) {
          newDashboard.panels[idx].gridPos = resolved.gridPos;
        }
      });
    }
  }

  return canonicalizeRows(newDashboard);
}

/**
 * Toggle row collapsed state
 */
export function toggleRowCollapsed(
  dashboard: GrafanaDashboard,
  rowId: number,
  collapsed: boolean
): GrafanaDashboard {
  const rowIndex = dashboard.panels.findIndex((p) => isRowPanel(p) && p.id === rowId);
  if (rowIndex === -1) {
    return dashboard;
  }

  const row = dashboard.panels[rowIndex] as RowPanel;
  const newDashboard: GrafanaDashboard = {
    ...dashboard,
    panels: dashboard.panels.map((p) => ({ ...p })),
  };

  const newRow = newDashboard.panels[rowIndex] as RowPanel;
  newRow.collapsed = collapsed;

  if (collapsed) {
    // Collapse: move band children to row.panels[]
    // Store panels with RELATIVE Y coordinates (relative to row header)
    const band = computeBands(dashboard.panels).find((b) => b.rowId === rowId);
    if (band) {
      const children = dashboard.panels.filter((p) => p.id && band.childIds.includes(p.id));
      const rowY = row.gridPos.y;
      const bandTop = rowY + 1; // Band starts below row header
      
      newRow.panels = children.map((p) => {
        const panel = { ...p };
        // Convert absolute Y to relative Y (relative to band top)
        panel.gridPos.y = panel.gridPos.y - bandTop;
        return panel;
      });
      // Remove from top-level
      newDashboard.panels = newDashboard.panels.filter((p) => !(p.id && band.childIds.includes(p.id)));
    } else {
      newRow.panels = [];
    }
  } else {
    // Expand: move row.panels[] back to top-level
    // Restore panels with ABSOLUTE Y coordinates
    if (newRow.panels && newRow.panels.length > 0) {
      const children = newRow.panels.map((p) => ({ ...p }));
      const rowY = newRow.gridPos.y;
      const bandTop = rowY + 1; // Band starts below row header
      
      children.forEach((child) => {
        if (child.id) {
          // Convert relative Y back to absolute Y
          child.gridPos.y = bandTop + child.gridPos.y;
        }
      });
      newDashboard.panels.push(...children);
      newRow.panels = [];
    }
  }

  return canonicalizeRows(newDashboard);
}

/**
 * Reorder rows by moving them to new positions
 */
export function reorderRows(
  dashboard: GrafanaDashboard,
  newRowIdOrder: number[]
): GrafanaDashboard {
  const newDashboard: GrafanaDashboard = {
    ...dashboard,
    panels: dashboard.panels.map((p) => ({ ...p })),
  };

  const rows = getRowHeaders(newDashboard.panels);
  const rowMap = new Map(rows.map((r) => [r.id!, r]));

  // Calculate new positions for each row
  const newPositions = new Map<number, number>();
  newRowIdOrder.forEach((rowId, index) => {
    const row = rowMap.get(rowId);
    if (row) {
      // Calculate new Y position
      const prevRow = index > 0 ? rowMap.get(newRowIdOrder[index - 1]) : null;
      let newY = 0;
      if (prevRow) {
        const prevBand = computeBands(dashboard.panels).find((b) => b.rowId === prevRow.id!);
        const prevBottom = prevBand ? prevBand.bottom : prevRow.gridPos.y + 1;
        newY = prevBottom;
      }
      newPositions.set(rowId, newY);
    }
  });

  // Calculate deltaY for each row's band
  rows.forEach((row) => {
    const newY = newPositions.get(row.id!);
    if (newY !== undefined) {
      const deltaY = newY - row.gridPos.y;
      const band = computeBands(dashboard.panels).find((b) => b.rowId === row.id!);
      
      // Move row header
      const rowIndex = newDashboard.panels.findIndex((p) => p.id === row.id!);
      if (rowIndex !== -1) {
        newDashboard.panels[rowIndex].gridPos.y = newY;
      }

      // Move band children
      if (band && row.collapsed !== true) {
        band.childIds.forEach((childId) => {
          const childIndex = newDashboard.panels.findIndex((p) => p.id === childId);
          if (childIndex !== -1) {
            newDashboard.panels[childIndex].gridPos.y += deltaY;
          }
        });
      }
    }
  });

  // Resolve collisions between bands
  const allTopLevel = getScopePanels(newDashboard, 'top-level');
  const afterCollisions = resolveCollisionsPushDown(
    { id: newRowIdOrder[0]!, gridPos: { x: 0, y: newPositions.get(newRowIdOrder[0]!)!, w: 24, h: 1 } },
    allTopLevel
  );

  // Apply resolved positions
  afterCollisions.forEach((resolved) => {
    const idx = newDashboard.panels.findIndex((p) => p.id === resolved.id);
    if (idx !== -1) {
      newDashboard.panels[idx].gridPos = resolved.gridPos;
    }
  });

  return canonicalizeRows(newDashboard);
}

/**
 * Move a row to a new Y position
 * Moves the row header and all its band children (if expanded)
 * Resolves collisions with other panels
 */
export function moveRow(
  dashboard: GrafanaDashboard,
  rowId: number,
  newY: number
): GrafanaDashboard {
  const rowIndex = dashboard.panels.findIndex((p) => isRowPanel(p) && p.id === rowId);
  if (rowIndex === -1) {
    return dashboard;
  }

  const row = dashboard.panels[rowIndex] as RowPanel;
  const currentY = row.gridPos.y;
  const deltaY = newY - currentY;

  // If no movement, return unchanged
  if (deltaY === 0) {
    return dashboard;
  }

  const newDashboard: GrafanaDashboard = {
    ...dashboard,
    panels: dashboard.panels.map((p) => ({ ...p })),
  };

  // Get band children IDs before moving (to exclude from collision resolution)
  const band = computeBands(dashboard.panels).find((b) => b.rowId === rowId);
  const bandChildIds = new Set<number>();
  if (row.collapsed !== true && band) {
    band.childIds.forEach((id) => bandChildIds.add(id));
  }

  // Move row header
  const newRowIndex = newDashboard.panels.findIndex((p) => p.id === rowId);
  if (newRowIndex !== -1) {
    const newRow = newDashboard.panels[newRowIndex] as RowPanel;
    newRow.gridPos = {
      ...newRow.gridPos,
      y: newY,
    };
  }

  // Move band children if row is expanded
  if (row.collapsed !== true && band) {
    band.childIds.forEach((childId) => {
      const childIndex = newDashboard.panels.findIndex((p) => p.id === childId);
      if (childIndex !== -1) {
        newDashboard.panels[childIndex].gridPos.y += deltaY;
      }
    });
  }

  // Resolve collisions for all top-level panels (band children are already moved together)
  // We need to resolve collisions between the moved row and other panels
  const allTopLevel = getScopePanels(newDashboard, 'top-level');
  const afterCollisions = resolveCollisionsPushDown(
    { id: rowId, gridPos: { x: 0, y: newY, w: 24, h: 1 } },
    allTopLevel
  );

  // Apply resolved positions
  afterCollisions.forEach((resolved) => {
    const idx = newDashboard.panels.findIndex((p) => p.id === resolved.id);
    if (idx !== -1) {
      // If collision resolution moved the row, adjust band children accordingly
      if (resolved.id === rowId && resolved.gridPos.y !== newY) {
        const actualDeltaY = resolved.gridPos.y - currentY;
        const newRow = newDashboard.panels[idx] as RowPanel;
        newRow.gridPos = resolved.gridPos;
        
        // Adjust band children to match the actual row position
        if (row.collapsed !== true && band) {
          band.childIds.forEach((childId) => {
            const childIndex = newDashboard.panels.findIndex((p) => p.id === childId);
            if (childIndex !== -1) {
              const originalChildY = dashboard.panels.find((p) => p.id === childId)?.gridPos.y || 0;
              const relativeY = originalChildY - currentY - 1;
              newDashboard.panels[childIndex].gridPos.y = resolved.gridPos.y + 1 + relativeY;
            }
          });
        }
      } else {
        // For other panels, just apply the resolved position
        newDashboard.panels[idx].gridPos = resolved.gridPos;
      }
    }
  });

  return canonicalizeRows(newDashboard);
}

/**
 * Delete a row from the dashboard
 * If row is expanded, moves its band children to top-level
 * If row is collapsed, moves its nested panels to top-level
 */
export function deleteRow(
  dashboard: GrafanaDashboard,
  rowId: number
): GrafanaDashboard {
  const rowIndex = dashboard.panels.findIndex((p) => isRowPanel(p) && p.id === rowId);
  if (rowIndex === -1) {
    return dashboard;
  }

  const row = dashboard.panels[rowIndex] as RowPanel;
  const newDashboard: GrafanaDashboard = {
    ...dashboard,
    panels: dashboard.panels.map((p) => ({ ...p })),
  };

  // Handle row's children based on collapse state
  if (row.collapsed === true) {
    // Collapsed row: move nested panels to top-level
    if (row.panels && row.panels.length > 0) {
      const children = row.panels.map((p) => ({ ...p }));
      // Add children to top-level panels array
      newDashboard.panels.push(...children);
    }
  } else {
    // Expanded row: band children are already at top-level, just need to keep them
    // (They're already in the panels array, so nothing to move)
  }

  // Remove the row panel
  newDashboard.panels = newDashboard.panels.filter((p) => p.id !== rowId);

  // Resolve collisions and pack remaining panels
  const allTopLevel = getScopePanels(newDashboard, 'top-level');
  const packed = autoPack(allTopLevel);

  // Apply packed positions
  packed.forEach((packed) => {
    const idx = newDashboard.panels.findIndex((p) => p.id === packed.id);
    if (idx !== -1) {
      newDashboard.panels[idx].gridPos = packed.gridPos;
    }
  });

  return canonicalizeRows(newDashboard);
}

/**
 * Pack a row (auto-pack within row scope)
 */
export function packRow(dashboard: GrafanaDashboard, rowId: number): GrafanaDashboard {
  const row = dashboard.panels.find((p) => isRowPanel(p) && p.id === rowId) as RowPanel | undefined;
  if (!row) {
    return dashboard;
  }

  const newDashboard: GrafanaDashboard = {
    ...dashboard,
    panels: dashboard.panels.map((p) => ({ ...p })),
  };

  const newRow = newDashboard.panels.find((p) => p.id === rowId) as RowPanel | undefined;
  if (!newRow) {
    return dashboard;
  }

  if (newRow.collapsed === true) {
    // Pack collapsed row's panels
    if (newRow.panels && newRow.panels.length > 0) {
      const scopePanels = newRow.panels.map((p) => ({ id: p.id!, gridPos: p.gridPos }));
      const packed = autoPack(scopePanels);
      
      packed.forEach((packed) => {
        const panel = newRow.panels!.find((p) => p.id === packed.id);
        if (panel) {
          panel.gridPos = packed.gridPos;
        }
      });
    }
  } else {
    // Pack expanded row's band children
    const band = computeBands(newDashboard.panels).find((b) => b.rowId === rowId);
    if (band) {
      const scopePanels = getScopePanels(newDashboard, { rowId, state: 'expanded' });
      const packed = autoPack(scopePanels);
      
      packed.forEach((packed) => {
        const idx = newDashboard.panels.findIndex((p) => p.id === packed.id);
        if (idx !== -1) {
          newDashboard.panels[idx].gridPos = packed.gridPos;
        }
      });
    }
  }

  return canonicalizeRows(newDashboard);
}

/**
 * Canonicalize rows to ensure Grafana JSON compatibility
 * Idempotent: calling multiple times yields the same result
 */
export function canonicalizeRows(dashboard: GrafanaDashboard): GrafanaDashboard {
  const newDashboard: GrafanaDashboard = {
    ...dashboard,
    panels: dashboard.panels.map((p) => ({ ...p })),
  };

  const rows = getRowHeaders(newDashboard.panels);
  const bands = computeBands(newDashboard.panels);

  // For each row
  for (const row of rows) {
    const rowIndex = newDashboard.panels.findIndex((p) => p.id === row.id!);
    if (rowIndex === -1) continue;

    const newRow = newDashboard.panels[rowIndex] as RowPanel;

    // Ensure row header has correct dimensions
    newRow.gridPos = {
      x: 0,
      y: newRow.gridPos.y,
      w: 24,
      h: 1,
    };

    if (newRow.collapsed === true) {
      // Collapsed: ensure all children are in row.panels[], remove from top-level
      if (!newRow.panels) {
        newRow.panels = [];
      }

      const band = bands.find((b) => b.rowId === row.id!);
      if (band) {
        // Remove band children from top-level
        newDashboard.panels = newDashboard.panels.filter(
          (p) => !(p.id && band.childIds.includes(p.id))
        );
      }

      // Ensure all children in row.panels[] have valid IDs
      newRow.panels = newRow.panels.filter((p) => p.id);
    } else {
      // Expanded: ensure row.panels is empty, children are at top-level
      if (newRow.panels) {
        newRow.panels = [];
      }

      const band = bands.find((b) => b.rowId === row.id!);
      if (band) {
        // Ensure children are within band (keep at top-level even if outside band)
        // This is handled by the band computation
      }
    }
  }

  // Ensure unique IDs across top-level and nested
  const allIds = new Set<number>();
  const duplicates: number[] = [];

  function checkPanel(panel: GrafanaPanel) {
    if (panel.id) {
      if (allIds.has(panel.id)) {
        duplicates.push(panel.id);
      } else {
        allIds.add(panel.id);
      }
    }
    if (isRowPanel(panel) && panel.panels) {
      panel.panels.forEach(checkPanel);
    }
  }

  newDashboard.panels.forEach(checkPanel);

  // Fix duplicates by reassigning IDs (find max ID and increment)
  if (duplicates.length > 0) {
    const maxId = Math.max(...Array.from(allIds), 0);
    let nextId = maxId + 1;

    function fixPanel(panel: GrafanaPanel) {
      if (panel.id && duplicates.includes(panel.id)) {
        panel.id = nextId++;
        duplicates.splice(duplicates.indexOf(panel.id), 1);
      }
      if (isRowPanel(panel) && panel.panels) {
        panel.panels.forEach(fixPanel);
      }
    }

    newDashboard.panels.forEach(fixPanel);
  }

  return newDashboard;
}

/**
 * Create a new row at a specific Y position
 */
export function createRow(
  dashboard: GrafanaDashboard,
  insertY: number,
  title: string = 'New row'
): GrafanaDashboard {
  // Find next available ID
  const allIds = new Set<number>();
  function collectIds(panel: GrafanaPanel) {
    if (panel.id) allIds.add(panel.id);
    if (isRowPanel(panel) && panel.panels) {
      panel.panels.forEach(collectIds);
    }
  }
  dashboard.panels.forEach(collectIds);
  const maxId = Math.max(...Array.from(allIds), 0);
  const newRowId = maxId + 1;

  // Create row header
  const rowHeader: RowPanel = {
    id: newRowId,
    type: 'row',
    title,
    gridPos: {
      x: 0,
      y: insertY,
      w: 24,
      h: 1,
    },
    collapsed: false,
    panels: [],
    'x-navixy': {
      sql: { statement: '' },
      dataset: { shape: 'table', columns: {} },
    },
  };

  // Check for overlaps and push down
  const rowRect: GridPos = { x: 0, y: insertY, w: 24, h: 1 };
  const topLevelPanels = getScopePanels(dashboard, 'top-level');
  const overlapping = topLevelPanels.filter((p) =>
    p.gridPos.x < rowRect.x + rowRect.w &&
    rowRect.x < p.gridPos.x + p.gridPos.w &&
    p.gridPos.y < rowRect.y + rowRect.h &&
    rowRect.y < p.gridPos.y + p.gridPos.h
  );

  const newDashboard: GrafanaDashboard = {
    ...dashboard,
    panels: [...dashboard.panels, rowHeader],
  };

  if (overlapping.length > 0) {
    // Resolve collisions
    const afterCollisions = resolveCollisionsPushDown(
      { id: newRowId, gridPos: rowRect },
      topLevelPanels
    );

    // Apply resolved positions
    afterCollisions.forEach((resolved) => {
      const idx = newDashboard.panels.findIndex((p) => p.id === resolved.id);
      if (idx !== -1) {
        newDashboard.panels[idx].gridPos = resolved.gridPos;
      }
    });
  }

  return canonicalizeRows(newDashboard);
}

