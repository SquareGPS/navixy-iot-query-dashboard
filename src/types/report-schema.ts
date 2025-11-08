/** Navixy Report Page – TypeScript types matching report-page.schema.json */

export type HexColor = string;
export type Align = "left" | "center" | "right";
export type SqlDriver = "postgres" | "mysql" | "mssql" | "clickhouse" | "sqlite" | "snowflake";

export interface ReportSchema {
  meta: Meta;
  datasources?: Datasource[];
  parameters?: Parameter[];
  theme?: Theme;
  rows: Row[];
}

export interface Meta {
  schema_version: string;
  report_id?: string;
  slug?: string;
  last_updated: string;
  updated_by: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface Theme {
  bg_color?: HexColor;
  font_color?: HexColor;
}

export interface Layout {
  span?: number;
  order?: number;
  align?: Align;
  responsive?: boolean;
}

export interface Design {
  bg_color?: HexColor;
  font_color?: HexColor;
  horizontal_rule?: boolean;
  padding?: string;
  css_class?: string;
}

export interface Datasource {
  id: string;
  driver: SqlDriver;
  connection?: {
    env?: string;
    dsn?: string;
    database?: string;
    host?: string;
    port?: number;
    ssl?: boolean;
  };
}

export type ParameterType = "string" | "integer" | "number" | "boolean" | "date" | "datetime" | "enum";

export interface Parameter {
  name: string;
  label?: string;
  type: ParameterType;
  required?: boolean;
  default?: unknown;
  allowed?: unknown[];
  description?: string;
}

export interface Query {
  id?: string;
  data_source_id?: string;
  sql: string;
  params?: Record<string, string | number | boolean>;
  timeout_ms?: number;
  row_limit?: number;
}

export interface Verify {
  row_count?: {
    eq?: number;
    min?: number;
    max?: number;
  };
  columns?: ColumnRule[];
  value_checks?: ValueCheck[];
}

export type ColumnPrimitive = "integer" | "number" | "string" | "boolean" | "date" | "datetime";

export interface ColumnRule {
  name: string;
  index?: number;
  type: ColumnPrimitive;
  max_length?: number;
  nullable?: boolean;
}

export interface ValueCheck {
  column: string;
  numeric_range?: { min?: number; max?: number };
  regex?: string;
  allowed_set?: unknown[];
  unique?: boolean;
}

export type Row = TilesRow | TableRow | AnnotationRow | ChartsRow;

export interface TilesRow {
  type: "tiles";
  title?: string;
  subtitle?: string;
  layout?: Layout;
  design?: Design;
  visuals: TileVisual[];
}

export interface TileVisual {
  kind: "tile";
  label: string;
  hint?: string;
  color?: HexColor;
  query: Query;
  verify?: Verify;
  options?: {
    prefix?: string;
    suffix?: string;
    precision?: number;
    target?: number;
    show_delta?: boolean;
    delta_query?: Query;
  };
}

export interface TableRow {
  type: "table";
  title?: string;
  subtitle?: string;
  layout?: Layout;
  design?: Design;
  visuals: [TableVisual];
}

export type TableColumnFormat =
  | "text"
  | "integer"
  | "decimal"
  | "percent"
  | "currency"
  | "date"
  | "datetime"
  | "duration";

export interface TableColumn {
  field: string;
  label?: string;
  align?: Align;
  format?: TableColumnFormat;
  precision?: number;
  width?: number | string;
  sortable?: boolean;
  truncate?: boolean;
}

export interface TableVisual {
  kind: "table";
  label: string;
  hint?: string;
  color?: HexColor;
  query: Query;
  verify?: Verify;
  options?: {
    paginate?: boolean;
    page_size?: number;
    columns?: TableColumn[];
  };
}

export interface AnnotationRow {
  type: "annotation";
  title?: string;
  subtitle?: string;
  layout?: Layout;
  design?: Design;
  visuals: [AnnotationVisual];
}

export interface AnnotationVisual {
  kind: "annotation";
  label?: string;
  hint?: string;
  color?: HexColor;
  options?: {
    section_name?: string;
    subtitle?: string;
    text?: string;
    markdown?: boolean;
    design?: Design;
  };
}

// Charts Row Types
export interface ChartsRow {
  type: "charts";
  title?: string;
  subtitle?: string;
  layout?: Layout;
  design?: Design;
  visuals: ChartVisual[];
}

export type ChartVisual = BarVisual | PieVisual | LineVisual;

export interface ChartCommonOptions {
  category_field: string;
  value_field: string;
  series_field?: string;
  sort_by?: "category" | "value";
  sort_dir?: "asc" | "desc";
  top_n?: number;
  show_legend?: boolean;
  legend_position?: "top" | "right" | "bottom" | "left" | "none";
  show_tooltips?: boolean;
  palette?: HexColor[];
}

export interface BarVisual {
  kind: "bar";
  label: string;
  hint?: string;
  color?: HexColor;
  query: Query;
  verify?: Verify;
  options: BarOptions;
}

export interface BarOptions extends ChartCommonOptions {
  orientation?: "vertical" | "horizontal";
  show_value_labels?: boolean;
  precision?: number;
}

export interface PieVisual {
  kind: "pie";
  label: string;
  hint?: string;
  color?: HexColor;
  query: Query;
  verify?: Verify;
  options: PieOptions;
}

export interface PieOptions extends ChartCommonOptions {
  donut?: boolean;
  inner_radius?: number;
  label_type?: "percent" | "value" | "category" | "none";
  precision?: number;
}

export interface LineVisual {
  kind: "line";
  label: string;
  hint?: string;
  color?: HexColor;
  query: Query;
  verify?: Verify;
  options: LineOptions;
}

export interface LineOptions extends ChartCommonOptions {
  line_style?: "solid" | "dashed" | "dotted";
  line_width?: number;
  show_points?: "always" | "auto" | "never";
  point_size?: number;
  interpolation?: "linear" | "step" | "smooth";
  fill_area?: "none" | "below" | "above";
  show_grid?: boolean;
  color_palette?: "classic" | "modern" | "pastel" | "vibrant";
}
