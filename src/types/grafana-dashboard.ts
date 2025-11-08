/**
 * Grafana Dashboard Types - Based on Grafana JSON Schema
 * Documentation: https://github.com/DanilNezhdanov/grafana-based-dashboard
 * Schema Reference: Grafana Dashboard JSON Model
 */

export interface GrafanaDashboard {
  id?: number | null;
  uid?: string;
  title: string;
  description?: string;
  tags?: string[];
  style?: 'dark' | 'light';
  timezone?: string;
  editable?: boolean;
  graphTooltip?: 0 | 1 | 2;
  time: {
    from: string;
    to: string;
  };
  refresh?: string;
  timepicker?: TimePickerConfig;
  schemaVersion?: number;
  version?: number;
  templating?: TemplatingConfig;
  annotations?: AnnotationsConfig;
  links?: DashboardLink[];
  'x-navixy'?: NavixyConfig;
  panels: GrafanaPanel[];
}

export interface TemplatingConfig {
  enable?: boolean;
  list: GrafanaVariable[];
}

export interface GrafanaVariable {
  type: 'constant' | 'query' | 'interval' | 'datasource' | 'custom' | 'textbox';
  name: string;
  label?: string;
  query?: string;
  datasource?: {
    type?: string;
    uid?: string;
  };
  current?: {
    value: string | string[];
    text: string;
  };
  options?: Array<{
    text: string;
    value: string;
    selected?: boolean;
  }>;
  refresh?: 0 | 1 | 2 | false; // Never, On Dashboard Load, On Time Range Change
  includeAll?: boolean;
  multi?: boolean;
  allValue?: string;
  allFormat?: 'wildcard' | 'regex' | 'glob' | 'pipe';
  multiFormat?: 'wildcard' | 'regex' | 'glob' | 'pipe';
  regex?: string;
  sort?: number;
  hide?: number;
  description?: string;
}

export interface TimePickerConfig {
  collapse?: boolean;
  enable?: boolean;
  hidden?: boolean;
  now?: boolean;
  nowDelay?: string;
  refresh_intervals?: string[];
  time_options?: string[];
  quickRanges?: Array<{
    from: string;
    to: string;
    display: string;
  }>;
}

export interface AnnotationsConfig {
  list: AnnotationQuery[];
}

export interface AnnotationQuery {
  builtIn?: number;
  name: string;
  type?: 'dashboard' | 'tags';
  enable?: boolean;
  hide?: boolean;
  iconColor?: string;
  datasource?: {
    type: string;
    uid: string;
  };
  target?: {
    type?: string;
    tags?: string[];
    limit?: number;
    matchAny?: boolean;
  };
  query?: string;
}

export interface DashboardLink {
  title: string;
  type: 'dashboards' | 'link';
  url?: string;
  tags?: string[];
  asDropdown?: boolean;
  icon?: string;
  tooltip?: string;
  targetBlank?: boolean;
  includeVars?: boolean;
  keepTime?: boolean;
}

export interface NavixyConfig {
  schemaVersion: string;
  execution?: {
    endpoint?: string;
    dialect?: 'postgresql' | 'mysql' | 'mssql' | 'clickhouse' | 'sqlite' | 'snowflake';
    timeout_ms?: number;
    max_rows?: number;
    read_only?: boolean;
    allowed_schemas?: string[];
  };
  parameters?: {
    bindings?: Record<string, string>;
  };
  params?: DashboardParameter[];
}

export interface DashboardParameter {
  name: string;
  type: 'time' | 'datetime' | 'number' | 'integer' | 'text' | 'boolean' | 'select' | 'multiselect';
  label?: string;
  description?: string;
  default?: any;
  required?: boolean;
  placeholder?: string;
  order?: number;
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
  format?: string;
  options?: Array<{ value: any; label: string }>;
  allowCustom?: boolean;
}

export interface GrafanaPanel {
  id?: number;
  type: GrafanaPanelType;
  title: string;
  description?: string;
  gridPos: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  datasource?: {
    type?: string;
    uid?: string;
  } | null;
  targets?: Array<{
    refId: string;
    expr?: string;
    query?: string;
    datasource?: {
      type: string;
      uid: string;
    };
  }>;
  fieldConfig?: {
    defaults?: {
      color?: {
        mode: string;
        fixedColor?: string;
      };
      custom?: Record<string, any>;
      mappings?: Array<Record<string, any>>;
      thresholds?: {
        mode: 'absolute' | 'percentage';
        steps: Array<{
          value: number | null;
          color: string;
        }>;
      };
      unit?: string;
      min?: number;
      max?: number;
      decimals?: number;
      displayName?: string;
      displayMode?: string;
    };
    overrides?: Array<{
      matcher: {
        id: string;
        options?: any;
      };
      properties?: Array<{
        id: string;
        value?: any;
      }>;
    }>;
  };
  options?: Record<string, any>;
  'x-navixy'?: NavixyPanelConfig;
  transparent?: boolean;
  maxDataPoints?: number;
  transformations?: Array<{
    id: string;
    options?: Record<string, any>;
  }>;
  collapsed?: boolean; // For row panels
  panels?: GrafanaPanel[]; // For row panels (nested children when collapsed)
  pluginVersion?: string;
}

export type GrafanaPanelType = 
  | 'stat'           // Stat panel (KPI-like)
  | 'bargauge'       // Bar gauge panel
  | 'timeseries'     // Time series panel
  | 'table'          // Table panel
  | 'text'           // Text panel
  | 'row'            // Row panel (for grouping)
  // Legacy/alias types for backward compatibility
  | 'kpi'            // Alias for 'stat'
  | 'barchart'       // Alias for 'bargauge'
  | 'linechart'      // Alias for 'timeseries'
  | 'piechart';      // For pie charts (may use bargauge or custom)

export interface NavixyPanelConfig {
  sql: {
    statement: string;
    params?: Record<string, NavixyParam>;
    bindings?: Record<string, string>;
  };
  dataset: {
    shape: 'kpi' | 'category_value' | 'time_value' | 'table' | 'pie';
    columns: Record<string, { type: NavixyColumnType }>;
  };
  verify?: {
    required_columns?: string[];
    min_rows?: number;
    max_rows?: number;
  };
  visualization?: NavixyVisualizationConfig;
}

export interface NavixyVisualizationConfig {
  // Table settings
  showHeader?: boolean;
  sortable?: boolean;
  pageSize?: number;
  showPagination?: boolean;
  columnWidth?: 'auto' | 'equal' | 'fit';
  rowHighlighting?: 'none' | 'alternating' | 'hover' | 'both';
  showTotals?: boolean;
  totalsRow?: 'top' | 'bottom';
  // Bar chart settings
  orientation?: 'horizontal' | 'vertical';
  stacking?: 'none' | 'stacked' | 'percent';
  showValues?: boolean;
  sortOrder?: 'asc' | 'desc' | 'none';
  barSpacing?: number;
  colorPalette?: 'classic' | 'modern' | 'pastel' | 'vibrant';
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  // Line chart settings
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineWidth?: number;
  showPoints?: 'always' | 'auto' | 'never';
  pointSize?: number;
  interpolation?: 'linear' | 'step' | 'smooth';
  fillArea?: 'none' | 'below' | 'above';
  showGrid?: boolean;
}

export interface NavixyParam {
  type: 'uuid' | 'timestamptz' | 'timestamp' | 'int' | 'integer' | 'string' | 'boolean' | 'numeric' | 'decimal';
  default?: any;
  min?: number;
  max?: number;
  description?: string;
}

export type NavixyColumnType = 
  | 'string' 
  | 'number' 
  | 'integer' 
  | 'boolean' 
  | 'timestamp' 
  | 'timestamptz' 
  | 'date' 
  | 'uuid' 
  | 'numeric' 
  | 'decimal';

export interface GrafanaTimeRange {
  from: string;
  to: string;
  raw?: {
    from: string;
    to: string;
  };
}

export interface GrafanaQueryResult {
  columns: Array<{
    name: string;
    type: NavixyColumnType;
  }>;
  rows: any[][];
  meta?: {
    executed_at: string;
    execution_time_ms: number;
    row_count: number;
  };
}

export interface GrafanaPanelData {
  series?: Array<{
    name: string;
    fields: Array<{
      name: string;
      type: string;
      values: any[];
    }>;
  }>;
  tables?: Array<{
    columns: Array<{
      text: string;
      type: string;
    }>;
    rows: any[][];
  }>;
  state: 'Loading' | 'Done' | 'Error';
  error?: string;
}

// Utility types for dashboard operations
export interface DashboardMeta {
  schema_version: string;
  dashboard_id?: string;
  slug?: string;
  last_updated: string;
  updated_by: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface DashboardConfig {
  title: string;
  meta: DashboardMeta;
  dashboard: GrafanaDashboard;
}

// Panel type-specific configurations
export interface KpiPanelOptions {
  valueOptions?: {
    unit?: string;
    decimals?: number;
    colorMode?: 'value' | 'background';
  };
  thresholds?: Array<{
    value: number;
    color: string;
  }>;
}

export interface ChartPanelOptions {
  legend?: {
    displayMode: 'list' | 'table' | 'hidden';
    placement: 'bottom' | 'right';
    showLegend: boolean;
  };
  tooltip?: {
    mode: 'single' | 'multi' | 'none';
  };
  axes?: {
    x?: {
      label?: string;
      show?: boolean;
    };
    y?: {
      label?: string;
      show?: boolean;
    };
  };
}

export interface TablePanelOptions {
  showHeader: boolean;
  sortBy?: string;
  sortDesc?: boolean;
  pageSize?: number;
  showPagination?: boolean;
}

export interface PieChartPanelOptions {
  legend?: {
    displayMode: 'list' | 'table' | 'hidden';
    placement: 'bottom' | 'right';
    showLegend: boolean;
  };
  pieType?: 'pie' | 'donut';
  displayLabels?: string[];
}

