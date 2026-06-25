import { repackPanels } from '@/layout/geometry/repack';
import type { GridPos } from '@/layout/geometry/grid';

interface SchemaPanel {
  id?: number | string;
  gridPos?: GridPos;
  [key: string]: unknown;
}

/**
 * Repack panels in a flat Grafana-style report schema (panels at root level).
 */
export function repackFlatReportSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const panels = schema.panels as SchemaPanel[] | undefined;
  if (!panels || panels.length === 0) return schema;

  const withGrid = panels.filter(
    (p) => p.gridPos && p.id !== undefined && p.id !== null
  ) as Array<{ id: number | string; gridPos: GridPos }>;

  if (withGrid.length === 0) return schema;

  const repacked = repackPanels(withGrid);
  const posMap = new Map(repacked.map((p) => [String(p.id), p.gridPos]));

  const newPanels = panels.map((panel) => {
    if (panel.id != null && posMap.has(String(panel.id))) {
      return { ...panel, gridPos: posMap.get(String(panel.id))! };
    }
    return panel;
  });

  return { ...schema, panels: newPanels };
}

/**
 * Repack nested dashboard.panels if present (CreateReportModal format).
 */
export function repackReportSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const dashboard = schema.dashboard as Record<string, unknown> | undefined;
  if (dashboard?.panels) {
    const repackedDashboard = repackFlatReportSchema(dashboard);
    return { ...schema, dashboard: repackedDashboard };
  }
  return repackFlatReportSchema(schema);
}
