import type { BusinessGoalId, ObjectScopeId, WizardKpiId } from './types';
import type { ReportTypeId } from '@/features/onboarding/types';

export interface BusinessGoalOption {
  id: BusinessGoalId;
  label: string;
  description: string;
  reportTypes: ReportTypeId[];
}

export interface ObjectScopeOption {
  id: ObjectScopeId;
  label: string;
  description: string;
}

export interface WizardKpiOption {
  id: WizardKpiId;
  label: string;
  description: string;
  /** Match metric panel titles (case-insensitive substring) */
  titlePatterns: string[];
  goals: BusinessGoalId[];
}

export const BUSINESS_GOALS: BusinessGoalOption[] = [
  {
    id: 'equipment-health',
    label: 'Equipment health',
    description: 'Device connectivity, sensors, engines, and asset diagnostics',
    reportTypes: ['hardware', 'live-status', 'anomalies'],
  },
  {
    id: 'driver-safety',
    label: 'Driver safety',
    description: 'Scoring, violations, aggressive driving, and safety KPIs',
    reportTypes: ['safety-security', 'driver-behavior', 'anomalies'],
  },
  {
    id: 'sla',
    label: 'SLA',
    description: 'Online/offline status, fleet availability, and service-level compliance',
    reportTypes: ['live-status', 'fleet-overview', 'hardware'],
  },
  {
    id: 'routes',
    label: 'Routes',
    description: 'Trips, distances, route patterns, and operational logistics',
    reportTypes: ['trips'],
  },
  {
    id: 'custom-analytics',
    label: 'Custom analytics',
    description: 'Flexible dashboard with a broad set of KPIs and reports',
    reportTypes: ['fleet-overview', 'safety-security', 'mileage-finance'],
  },
];

export const OBJECT_SCOPES: ObjectScopeOption[] = [
  {
    id: 'all-vehicles',
    label: 'All objects',
    description: 'Analyze the entire fleet — no grouping filter in Parameters',
  },
  {
    id: 'group',
    label: 'By groups',
    description: 'Adds a Group filter to Parameters; applies to panels that output group columns',
  },
  {
    id: 'department',
    label: 'By departments',
    description: 'Adds a Department filter to Parameters for department-level breakdowns',
  },
  {
    id: 'geozone',
    label: 'By geozones',
    description: 'Adds a Geozone filter to Parameters for zone-based panels',
  },
  {
    id: 'garage',
    label: 'By garages',
    description: 'Adds a Garage filter (depot/hub zones) to Parameters',
  },
];

export const WIZARD_KPIS: WizardKpiOption[] = [
  {
    id: 'fuel-consumption',
    label: 'Fuel consumption',
    description: 'Mileage and fuel-related metrics (via distance KPIs)',
    titlePatterns: ['mileage', 'distance', 'km', 'fuel'],
    goals: ['equipment-health', 'routes', 'custom-analytics', 'sla'],
  },
  {
    id: 'idle-time',
    label: 'Idle time',
    description: 'Engine-on idle periods and idling events',
    titlePatterns: ['idle', 'idling', 'parked', 'stopped'],
    goals: ['driver-safety', 'sla', 'custom-analytics', 'equipment-health'],
  },
  {
    id: 'utilization',
    label: 'Utilization',
    description: 'Active assets, movement, and fleet utilization',
    titlePatterns: [
      'active',
      'moving',
      'online',
      'registered',
      'utilization',
      'trip',
      'engine hour',
    ],
    goals: ['sla', 'routes', 'equipment-health', 'custom-analytics'],
  },
  {
    id: 'harsh-driving',
    label: 'Harsh driving',
    description: 'Hard braking, acceleration, overspeed, and violations',
    titlePatterns: [
      'harsh',
      'braking',
      'acceleration',
      'overspeed',
      'speeding',
      'violation',
      'aggressive',
      'score',
      'event',
    ],
    goals: ['driver-safety', 'custom-analytics', 'routes'],
  },
  {
    id: 'mileage',
    label: 'Mileage',
    description: 'Total and average mileage across fleet or assets',
    titlePatterns: ['mileage', 'distance', 'km'],
    goals: ['routes', 'custom-analytics', 'sla'],
  },
  {
    id: 'overspeed',
    label: 'Overspeed',
    description: 'Overspeed trips, max speed, and speeding events',
    titlePatterns: ['overspeed', 'speeding', 'max speed', 'speed avg', 'speed 120'],
    goals: ['driver-safety', 'routes'],
  },
  {
    id: 'connectivity',
    label: 'Connectivity',
    description: 'Online, offline, GPS offline, and no-signal status',
    titlePatterns: ['online', 'offline', 'signal', 'gps offline', 'connect'],
    goals: ['sla', 'equipment-health'],
  },
  {
    id: 'trip-count',
    label: 'Trip count',
    description: 'Number of trips, trip duration, and drive time',
    titlePatterns: ['trip', 'drive time'],
    goals: ['routes', 'custom-analytics'],
  },
  {
    id: 'geofence',
    label: 'Geofencing',
    description: 'Zone visits, crossings, and geofence violations',
    titlePatterns: ['zone', 'geofence', 'crossing'],
    goals: ['sla', 'driver-safety', 'routes'],
  },
  {
    id: 'engine-health',
    label: 'Engine health',
    description: 'Engine hours, temperature, RPM, and overheating',
    titlePatterns: ['engine', 'temp', 'rpm', 'overheat', '°c'],
    goals: ['equipment-health'],
  },
];

/** Template priority per business goal (from onboarding catalog ids) */
export const GOAL_TEMPLATE_PRIORITY: Record<BusinessGoalId, string[]> = {
  'equipment-health': [
    'hw-status',
    'engine-operation',
    'hw-asset-detail',
    'fleet-anomaly',
    'object-status',
    'premium-safety-security',
  ],
  'driver-safety': [
    'premium-safety-security',
    'driver-performance',
    'behavior-impact',
    'fleet-performance',
    'fleet-anomaly',
    'leasing',
  ],
  sla: [
    'object-status',
    'hw-status',
    'fleet-reports',
    'fleet-anomaly',
    'fleet-performance',
    'premium-safety-security',
  ],
  routes: [
    'trips-yesterday',
    'trip-operations',
    'fleet-reports',
    'fleet-performance',
    'behavior-impact',
  ],
  'custom-analytics': [
    'fleet-performance',
    'premium-safety-security',
    'fleet-reports',
    'behavior-impact',
    'vehicle-mileage',
    'driver-performance',
  ],
};

export const DEFAULT_WIZARD_KPIS: WizardKpiId[] = [
  'fuel-consumption',
  'idle-time',
  'utilization',
  'harsh-driving',
];

export function getKpisForGoal(goal: BusinessGoalId): WizardKpiOption[] {
  return WIZARD_KPIS.filter((k) => k.goals.includes(goal));
}

export function getGoalLabel(goal: BusinessGoalId): string {
  return BUSINESS_GOALS.find((g) => g.id === goal)?.label ?? goal;
}

export function getScopeLabel(scope: ObjectScopeId): string {
  return OBJECT_SCOPES.find((s) => s.id === scope)?.label ?? scope;
}
