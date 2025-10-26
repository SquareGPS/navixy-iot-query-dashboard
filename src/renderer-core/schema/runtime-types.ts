/**
 * Navixy Renderer Core Types
 * Core interfaces for the renderer runtime
 */

import type { GrafanaDashboard, DataRows, DataColumn } from './grafana-dashboard';

// Render Context
export interface RenderContext {
  dashboardUid: string;
  time: { from: Date; to: Date };
  vars: Record<string, unknown>;     // Grafana-style inputs (strings/arrays)
  bindings: Record<string, unknown>; // resolved & typed for SQL params
  execution: {
    endpoint: string;
    dialect: "postgresql";
    timeoutMs: number;
    maxRows: number;
    readOnly: boolean;
    allowedSchemas: string[];
    auth?: { token?: string };
  };
}

// Panel Handler API
export interface PanelHandler<TProps = any> {
  type: string; // "barchart" | "linechart" | "piechart" | "kpi" | "table" | "annotation"
  // Called after verify+transform; input is strictly typed by DatasetSpec
  render: (mount: HTMLElement | null, data: DataRows, props: TProps) => void | (() => void);
  // Optional lightweight preflight (e.g., compute axis/domain once)
  prepare?: (data: DataRows, props: TProps) => unknown;
  // Optional SSR/measure hook for adapters
  measure?: (containerWidth: number) => { minHeight: number };
}

// Panel State Machine
export type PanelState = "idle" | "loading" | "ready" | "empty" | "error";

export interface PanelContext {
  id: string;
  panelId: number;
  type: string;
  state: PanelState;
  data?: DataRows;
  error?: PanelError;
  mount?: HTMLElement;
  props?: Record<string, any>;
  dispose?: () => void;
}

export interface PanelError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Query Execution
export interface QueryResult {
  data: DataRows;
  error?: PanelError;
  stats: {
    elapsedMs: number;
    cacheHit: boolean;
  };
}

export interface QueryPlan {
  panelId: string;
  priority: number;
  exec: () => Promise<QueryResult>;
  fingerprint: string;
}

// Cache
export interface CacheEntry {
  data: DataRows;
  timestamp: number;
  ttl: number;
}

export interface CacheKey {
  dashboardUid: string;
  panelId: string;
  statementHash: string;
  paramsHash: string;
  schemaVersion: string;
}

// Variable Resolution
export interface ResolvedVariable {
  name: string;
  value: unknown;
  type: string;
  error?: string;
}

// Validation
export interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Transform
export interface TransformResult {
  data: DataRows;
  applied: string[];
  errors: ValidationError[];
}

// Store Events
export interface StoreEvent {
  type: "panel_state_changed" | "panel_data_updated" | "panel_error" | "dashboard_loaded";
  panelId?: string;
  data?: any;
}

export interface StoreSubscription {
  unsubscribe: () => void;
}

// Dashboard Runtime
export interface DashboardRuntime {
  dashboard: GrafanaDashboard;
  context: RenderContext;
  panels: Map<string, PanelContext>;
  store: {
    getState: (panelId: string) => PanelContext | undefined;
    setState: (panelId: string, state: PanelState) => void;
    setData: (panelId: string, data: DataRows) => void;
    setError: (panelId: string, error: PanelError) => void;
    subscribe: (callback: (event: StoreEvent) => void) => StoreSubscription;
  };
  actions: {
    loadDashboard: (json: string) => Promise<void>;
    updateTimeRange: (from: Date, to: Date) => Promise<void>;
    updateVariables: (vars: Record<string, unknown>) => Promise<void>;
    refreshPanel: (panelId: string) => Promise<void>;
    refreshAll: () => Promise<void>;
  };
}
