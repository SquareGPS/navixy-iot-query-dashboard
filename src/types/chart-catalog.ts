/**
 * Types for the drag-n-drop Chart Library catalog (FR-11365).
 *
 * Source of truth: `dashboard_studio_meta_data.chart_preset_catalog` — a singleton
 * row (id = 1) maintained by the analyst directly in the client DB. The `catalog`
 * jsonb column has the shape `{ schemaVersion, groups }`. Verified against the live
 * client137823 catalog on 2026-06-16 (8 groups / 23 presets).
 */

/**
 * A ready-made panel object embedded in a preset — the same shape as an element of
 * `dashboard.panels[]`, minus `id` and `gridPos.x/y`, which are assigned on drop.
 */
export interface ChartPresetPanel {
  /** kpi | stat | piechart | barchart | table | geomap | ... (all already renderable) */
  type: string;
  title?: string;
  gridPos: { w: number; h: number; x?: number; y?: number };
  options?: Record<string, unknown>;
  fieldConfig?: unknown;
  'x-navixy'?: {
    sql?: { statement: string; params?: Record<string, unknown> };
    verify?: { max_rows?: number };
    dataset?: { shape?: string; columns?: Record<string, unknown> };
  };
}

export interface ChartPreset {
  id: string;
  label: string;
  order: number;
  icon?: string;
  /** Catalog-only metadata (UI/filtering); NOT copied into the dashboard panel on drop. */
  tags?: string[];
  roles?: string[];
  industries?: string[];
  panel: ChartPresetPanel;
}

export interface ChartGroup {
  id: string;
  label: string;
  order: number;
  icon?: string;
  presets: ChartPreset[];
}

export interface ChartCatalog {
  schemaVersion: string;
  groups: ChartGroup[];
}
