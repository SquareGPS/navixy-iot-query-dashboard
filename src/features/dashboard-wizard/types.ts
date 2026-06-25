export type WizardStep = 'question' | 'scope' | 'kpi' | 'review' | 'creating';

export type BusinessGoalId =
  | 'equipment-health'
  | 'driver-safety'
  | 'sla'
  | 'routes'
  | 'custom-analytics';

export type ObjectScopeId =
  | 'all-vehicles'
  | 'group'
  | 'department'
  | 'geozone'
  | 'garage';

export type WizardKpiId =
  | 'fuel-consumption'
  | 'idle-time'
  | 'utilization'
  | 'harsh-driving'
  | 'mileage'
  | 'overspeed'
  | 'connectivity'
  | 'trip-count'
  | 'geofence'
  | 'engine-health';

export interface WizardSelection {
  goal: BusinessGoalId;
  scope: ObjectScopeId;
  kpis: WizardKpiId[];
}

export interface WizardResolution {
  templateId: string;
  templateTitle: string;
  dashboardTitle: string;
  matchedMetricIds: number[];
  matchedKpiLabels: string[];
  score: number;
}
