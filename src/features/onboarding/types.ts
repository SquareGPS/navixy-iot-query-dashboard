export type OnboardingRoleId =
  | 'fleet-manager'
  | 'operations-manager'
  | 'dispatcher'
  | 'maintenance-manager'
  | 'finance-manager'
  | 'partner-admin';

export type OnboardingStep = 'role' | 'goal' | 'kpi' | 'creating';

/** Dashboard type — primary grouping axis in the template picker */
export type ReportTypeId =
  | 'fleet-overview'
  | 'safety-security'
  | 'trips'
  | 'live-status'
  | 'hardware'
  | 'mileage-finance'
  | 'driver-behavior'
  | 'anomalies';

export type TemplateCategory =
  | 'Fleet overview'
  | 'Safety'
  | 'Safety & security'
  | 'Trips'
  | 'Mileage'
  | 'Live status'
  | 'Hardware'
  | 'Engine & workload'
  | 'Finance & leasing'
  | 'Geofencing'
  | 'Anomalies'
  | 'Driver scoring'
  | 'Behavior';

export interface OnboardingRole {
  id: OnboardingRoleId;
  title: string;
  description: string;
}

export interface PanelCounts {
  /** KPI tile count */
  kpi: number;
  /** Stat tile count (summary metrics) */
  stat: number;
  charts: number;
  tables: number;
  maps: number;
  total: number;
}

export interface OnboardingTemplate {
  id: string;
  title: string;
  focus: string;
  description: string;
  reportType: ReportTypeId;
  categories: TemplateCategory[];
  kpiHighlights: string[];
  panelCounts: PanelCounts;
  dashboardTitle: string;
  period: string;
}

export interface MetricPanel {
  id: number;
  title: string;
  type: string;
}

export interface MetricPanelGroup {
  label: string;
  metrics: MetricPanel[];
}
