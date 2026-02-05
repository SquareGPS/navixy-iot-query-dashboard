/**
 * Grafana Dashboard JSON Schema Types
 * Based on Grafana's dashboard JSON model with Navixy extensions
 */

export interface GrafanaDashboard {
  dashboard: Dashboard;
  "x-navixy": NavixyExtensions;
}

export interface Dashboard {
  id?: number;
  uid: string;
  title: string;
  description?: string;
  tags?: string[];
  timezone?: string;
  refresh?: string;
  time: TimeRange;
  templating: Templating;
  panels: Panel[];
  annotations?: Annotations;
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface Templating {
  list: Variable[];
}

export interface Variable {
  name: string;
  type: "query" | "interval" | "datasource" | "custom" | "textbox" | "constant";
  label?: string;
  description?: string;
  query?: string;
  current: VariableValue;
  options?: VariableOption[];
  refresh?: number;
  regex?: string;
  sort?: number;
  multi?: boolean;
  includeAll?: boolean;
  allValue?: string;
  hide?: number;
}

export interface VariableValue {
  text: string;
  value: string | string[];
}

export interface VariableOption {
  text: string;
  value: string;
  selected?: boolean;
}

export interface Panel {
  id: number;
  title: string;
  type: PanelType;
  gridPos: GridPosition;
  targets: Target[];
  fieldConfig: FieldConfig;
  options?: Record<string, any>;
  "x-navixy"?: NavixyPanelExt;
}

export type PanelType = 
  | "barchart" 
  | "linechart" 
  | "piechart" 
  | "stat" 
  | "table" 
  | "text"
  | "geomap";

export interface GridPosition {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface Target {
  refId: string;
  datasource?: DatasourceRef;
  query?: string;
}

export interface DatasourceRef {
  type: string;
  uid: string;
}

export interface FieldConfig {
  defaults: FieldConfigDefaults;
  overrides?: FieldConfigOverride[];
}

export interface FieldConfigDefaults {
  color?: FieldColor;
  custom?: Record<string, any>;
  mappings?: ValueMapping[];
  thresholds?: ThresholdsConfig;
  unit?: string;
  min?: number;
  max?: number;
  decimals?: number;
}

export interface FieldColor {
  mode: "fixed" | "thresholds" | "palette-classic" | "palette-modern" | "continuous-GrYlRd" | "continuous-RdYlGr" | "continuous-BlPu" | "continuous-YlOrRd" | "continuous-blues" | "continuous-greens" | "continuous-reds" | "continuous-purples";
  fixedColor?: string;
}

export interface ValueMapping {
  type: "value" | "range" | "regex";
  value?: string;
  text?: string;
  from?: number;
  to?: number;
  result?: ValueMappingResult;
}

export interface ValueMappingResult {
  text?: string;
  color?: string;
}

export interface ThresholdsConfig {
  mode: "absolute" | "percentage";
  steps: Threshold[];
}

export interface Threshold {
  color: string;
  value?: number;
}

export interface FieldConfigOverride {
  matcher: MatcherConfig;
  properties: FieldConfigOverrideProperty[];
}

export interface MatcherConfig {
  id: string;
  options?: any;
}

export interface FieldConfigOverrideProperty {
  id: string;
  value?: any;
}

export interface Annotations {
  list: AnnotationQuery[];
}

export interface AnnotationQuery {
  name: string;
  datasource: DatasourceRef;
  enable: boolean;
  iconColor: string;
  query: string;
  target?: Target;
}

// Navixy Extensions
export interface NavixyExtensions {
  schemaVersion: string;
  execution: ExecutionConfig;
}

export interface ExecutionConfig {
  endpoint: string;
  dialect: "postgresql";
  timeoutMs: number;
  maxRows: number;
  readOnly: boolean;
  allowedSchemas: string[];
  auth?: {
    token?: string;
  };
}

export interface NavixyPanelExt {
  sql?: QuerySpec;
  dataset?: DatasetSpec;
  verify?: VerifySpec;
  transform?: TransformStep[];
  on_empty?: "show_placeholder" | "show_message";
  on_error?: "show_message";
}

export interface QuerySpec {
  statement: string;
  params: Record<string, ParamSpec>;
  bindings: Record<string, string>;
  limits?: {
    timeoutMs?: number;
    maxRows?: number;
  };
  readOnly?: boolean;
}

export type ParamType =
  | "uuid" 
  | "int" 
  | "numeric" 
  | "text" 
  | "timestamptz"
  | "bool" 
  | "json" 
  | "text[]" 
  | "uuid[]";

export interface ParamSpec {
  type: ParamType;
  default?: unknown;
  min?: number;
  max?: number;
}

export type DatasetShape = 
  | "category_value"
  | "time_value" 
  | "pie"
  | "kpi"
  | "table";

export interface DatasetSpec {
  shape: DatasetShape;
  columns: Record<string, { type: DataColumn["type"] }>;
}

export interface VerifySpec {
  required_columns?: string[];
  types?: Record<string, DataColumn["type"]>;
  min_rows?: number;
  max_rows?: number;
  unique?: string[];
}

export interface TransformStep {
  type: "sort" | "limit" | "rename" | "calc" | "pivot" | "unpivot";
  config: Record<string, any>;
}

// Data Types
export interface DataColumn { 
  name: string; 
  type: "string" | "number" | "boolean" | "timestamp" | "json"; 
}

export interface DataRows { 
  columns: DataColumn[]; 
  rows: unknown[][]; 
  stats?: { 
    rowCount: number; 
    elapsedMs: number; 
  }; 
}
