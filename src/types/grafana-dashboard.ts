/**
 * Grafana Dashboard Types - Based on Navixy "Grafana-JSON+SQL" format
 * Documentation: https://github.com/DanilNezhdanov/grafana-based-dashboard
 */

export interface GrafanaDashboard {
  title: string;
  uid?: string;
  time?: {
    from: string;
    to: string;
  };
  templating?: {
    list: GrafanaVariable[];
  };
  'x-navixy'?: NavixyConfig;
  panels: GrafanaPanel[];
}

export interface GrafanaVariable {
  type: 'constant' | 'query' | 'interval' | 'datasource' | 'custom';
  name: string;
  label?: string;
  query: string;
  current?: {
    value: string;
    text: string;
  };
  options?: Array<{
    text: string;
    value: string;
    selected?: boolean;
  }>;
  refresh?: 0 | 1 | 2; // Never, On Dashboard Load, On Time Range Change
  includeAll?: boolean;
  multi?: boolean;
  allValue?: string;
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
}

export interface GrafanaPanel {
  id?: number; // Optional ID field for panel identification
  type: 'kpi' | 'barchart' | 'linechart' | 'piechart' | 'table' | 'text' | 'stat' | 'timeseries' | 'row';
  title: string;
  gridPos: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  'x-navixy'?: NavixyPanelConfig;
  collapsed?: boolean; // For row panels
  panels?: GrafanaPanel[]; // For row panels (nested children when collapsed)
  targets?: Array<{
    refId: string;
    expr?: string;
    datasource?: {
      type: string;
      uid: string;
    };
  }>;
  fieldConfig?: {
    defaults?: {
      color?: {
        mode: string;
      };
      custom?: Record<string, any>;
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
}

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

