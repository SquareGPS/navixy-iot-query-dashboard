import type {
  OnboardingRoleId,
  OnboardingTemplate,
  ReportTypeId,
  TemplateCategory,
} from './types';
import { REPORT_TYPES, getReportTypeMeta, type ReportTypeMeta } from './reportTypes';

export const ROLE_QUESTIONS: Record<OnboardingRoleId, string> = {
  'fleet-manager': 'Want to track fleet efficiency, safety, and driver performance?',
  'operations-manager': 'Want to optimize trips and daily operational throughput?',
  dispatcher: 'Need live status and trip visibility for dispatch decisions?',
  'maintenance-manager': 'Want to monitor hardware health, engines, and asset detail?',
  'finance-manager': 'Want to analyze mileage, leasing, and cost-related metrics?',
  'partner-admin': 'Need multi-fleet visibility across partner accounts?',
};

const ALL_TEMPLATE_IDS = [
  'fleet-anomaly',
  'fleet-performance',
  'fleet-reports',
  'trip-operations',
  'engine-operation',
  'leasing',
  'object-status',
  'trips-yesterday',
  'vehicle-mileage',
  'premium-safety-security',
  'hw-status',
  'driver-performance',
  'behavior-impact',
  'hw-asset-detail',
] as const;

/** Role-prioritized order — all 14 templates, best match first */
export const ROLE_TEMPLATE_ORDER: Record<OnboardingRoleId, string[]> = {
  'fleet-manager': [
    'premium-safety-security',
    'fleet-performance',
    'driver-performance',
    'behavior-impact',
    'fleet-anomaly',
    'fleet-reports',
    'vehicle-mileage',
    'trip-operations',
    'trips-yesterday',
    'object-status',
    'hw-status',
    'engine-operation',
    'leasing',
    'hw-asset-detail',
  ],
  'operations-manager': [
    'trip-operations',
    'trips-yesterday',
    'behavior-impact',
    'fleet-performance',
    'fleet-reports',
    'driver-performance',
    'premium-safety-security',
    'fleet-anomaly',
    'object-status',
    'hw-status',
    'vehicle-mileage',
    'engine-operation',
    'leasing',
    'hw-asset-detail',
  ],
  dispatcher: [
    'trips-yesterday',
    'hw-status',
    'object-status',
    'hw-asset-detail',
    'trip-operations',
    'fleet-reports',
    'fleet-anomaly',
    'fleet-performance',
    'premium-safety-security',
    'vehicle-mileage',
    'behavior-impact',
    'driver-performance',
    'engine-operation',
    'leasing',
  ],
  'maintenance-manager': [
    'engine-operation',
    'hw-status',
    'hw-asset-detail',
    'premium-safety-security',
    'fleet-anomaly',
    'trip-operations',
    'fleet-performance',
    'behavior-impact',
    'fleet-reports',
    'object-status',
    'trips-yesterday',
    'driver-performance',
    'vehicle-mileage',
    'leasing',
  ],
  'finance-manager': [
    'leasing',
    'vehicle-mileage',
    'behavior-impact',
    'fleet-reports',
    'driver-performance',
    'fleet-performance',
    'trip-operations',
    'trips-yesterday',
    'premium-safety-security',
    'fleet-anomaly',
    'object-status',
    'hw-status',
    'engine-operation',
    'hw-asset-detail',
  ],
  'partner-admin': [
    'hw-status',
    'object-status',
    'fleet-reports',
    'premium-safety-security',
    'fleet-performance',
    'fleet-anomaly',
    'trips-yesterday',
    'trip-operations',
    'vehicle-mileage',
    'behavior-impact',
    'driver-performance',
    'engine-operation',
    'leasing',
    'hw-asset-detail',
  ],
};

export const ONBOARDING_TEMPLATES: OnboardingTemplate[] = [
  {
    id: 'fleet-anomaly',
    title: 'Fleet Anomaly Monitor',
    focus: 'Anomaly detection',
    reportType: 'anomalies',
    description:
      'Detect GPS signal loss (3+ days), prolonged stops (24h+), and abnormal geozone exits before they impact ops.',
    categories: ['Anomalies', 'Safety', 'Geofencing'],
    kpiHighlights: [
      'GPS Offline 3+ Days',
      'Long Stops 24h+',
      'Zone Exits 3+/Month',
      'Total Vehicles',
    ],
    panelCounts: { kpi: 4, stat: 0, charts: 3, tables: 2, maps: 0, total: 9 },
    dashboardTitle: 'Fleet Anomaly Monitor',
    period: 'Last 30 days',
  },
  {
    id: 'fleet-performance',
    title: 'Fleet Performance Dashboard',
    focus: 'Full fleet KPIs',
    reportType: 'fleet-overview',
    description:
      '30-day view across 4 blocks: fleet overview, driver performance, safety events, and geozone monitoring.',
    categories: ['Fleet overview', 'Safety', 'Geofencing'],
    kpiHighlights: [
      'Total Mileage 30d',
      'Speeding Events 30d',
      'Active Drivers 30d',
      'Zone Visits 30d',
    ],
    panelCounts: { kpi: 16, stat: 0, charts: 9, tables: 4, maps: 0, total: 33 },
    dashboardTitle: 'Fleet Performance Dashboard',
    period: 'Last 30 days',
  },
  {
    id: 'fleet-reports',
    title: 'Fleet Reports Dashboard',
    focus: 'Ops snapshot + map',
    reportType: 'fleet-overview',
    description:
      'Online/offline units, speeding violations, zone kilometers, supply voltage, mileage table, and last-known location map.',
    categories: ['Fleet overview', 'Live status', 'Mileage'],
    kpiHighlights: [
      'Online / Offline Units',
      'Inactive >5 Days',
      'Speeding Violations (30d)',
      'Last Known Location',
    ],
    panelCounts: { kpi: 4, stat: 0, charts: 2, tables: 4, maps: 1, total: 11 },
    dashboardTitle: 'Fleet Reports Dashboard',
    period: 'Last 30 days',
  },
  {
    id: 'trip-operations',
    title: 'Trip Operations Dashboard',
    focus: 'Shift-based trips',
    reportType: 'trips',
    description:
      'Day/night shift trip counts, durations, distances, short/long trips, and high-speed events for last 7 days.',
    categories: ['Trips', 'Fleet overview'],
    kpiHighlights: [
      'Trips Yesterday (08–19 / 19–08)',
      'Avg Trip Duration & Distance',
      'Long Trips >8h',
      'Speed AVG 80+ km/h',
    ],
    panelCounts: { kpi: 15, stat: 1, charts: 6, tables: 3, maps: 0, total: 25 },
    dashboardTitle: 'Trip Operations Dashboard',
    period: 'Yesterday & last 7 days',
  },
  {
    id: 'engine-operation',
    title: 'Engine Operation',
    focus: 'Engine & workload',
    reportType: 'hardware',
    description:
      'Engine hours, zone visits, overheating units (>95°C), unauthorized km, workload bands, and trip distance.',
    categories: ['Engine & workload', 'Hardware'],
    kpiHighlights: [
      'Engine Hours (1d)',
      'Zone Visits (1d)',
      'Temp >95°C (1d)',
      'Unauthorized km (1d)',
    ],
    panelCounts: { kpi: 4, stat: 0, charts: 6, tables: 1, maps: 0, total: 11 },
    dashboardTitle: 'Heavy Machinery – Actual engine operation',
    period: 'Last 7 days',
  },
  {
    id: 'leasing',
    title: 'Leasing Dashboard',
    focus: 'Contracts & idle cost',
    reportType: 'mileage-finance',
    description:
      'Driver/vehicle contract expiry dates, harsh braking/turns/acceleration, and idle time statistics.',
    categories: ['Finance & leasing', 'Behavior'],
    kpiHighlights: [
      'Total Idle Time',
      'Harsh Braking Events',
      'Contract Expiry Dates',
      'Harsh Acceleration',
    ],
    panelCounts: { kpi: 1, stat: 2, charts: 5, tables: 1, maps: 0, total: 9 },
    dashboardTitle: 'Leasing Dashboard',
    period: 'Last 72 hours',
  },
  {
    id: 'object-status',
    title: 'Object Status Dashboard',
    focus: 'Live connectivity',
    reportType: 'live-status',
    description:
      'Real-time breakdown: online, standby, moving, parked, stopped, offline, and no-signal objects.',
    categories: ['Live status', 'Fleet overview'],
    kpiHighlights: [
      'Online',
      'Moving / Parked / Stopped',
      'Offline / No Signal',
      'Registered Objects',
    ],
    panelCounts: { kpi: 8, stat: 0, charts: 2, tables: 1, maps: 0, total: 11 },
    dashboardTitle: 'Object Status Dashboard',
    period: 'Last 72 hours',
  },
  {
    id: 'trips-yesterday',
    title: 'Trips Dashboard (Yesterday)',
    focus: 'Yesterday deep-dive',
    reportType: 'trips',
    description:
      '8 summary stats plus 11 charts: trip/distance/time trends, hourly patterns, distance/duration bands, top vehicles.',
    categories: ['Trips', 'Mileage'],
    kpiHighlights: [
      'Total Trips',
      'Total Distance (km)',
      'Peak Speed (km/h)',
      'Zone Retention Rate (%)',
    ],
    panelCounts: { kpi: 0, stat: 8, charts: 12, tables: 2, maps: 0, total: 22 },
    dashboardTitle: 'Trips Dashboard (Yesterday)',
    period: 'Yesterday',
  },
  {
    id: 'vehicle-mileage',
    title: 'Vehicle Mileage Dashboard',
    focus: 'Mileage by time category',
    reportType: 'mileage-finance',
    description:
      'Business hours vs after-hours vs weekend mileage, weekly trend, and telematics message activity.',
    categories: ['Mileage', 'Finance & leasing'],
    kpiHighlights: [
      'Total Mileage (km)',
      'Mileage per Vehicle',
      'Business / After-hours Split',
      'Messages Over Time',
    ],
    panelCounts: { kpi: 2, stat: 0, charts: 3, tables: 0, maps: 0, total: 5 },
    dashboardTitle: 'Vehicle Mileage Dashboard',
    period: 'Last 72 hours',
  },
  {
    id: 'premium-safety-security',
    title: 'Safety & Security (Premium)',
    focus: 'Premium 24h safety',
    reportType: 'safety-security',
    description:
      '33 KPIs across security, safety, asset condition, and cargo: geofence, overspeed, GNSS, doors, panic/SOS.',
    categories: ['Safety & security', 'Geofencing', 'Anomalies'],
    kpiHighlights: [
      'Geofence Crossings',
      'Overspeed Trips',
      'GNSS Degraded',
      'Door / Panic Events',
    ],
    panelCounts: { kpi: 33, stat: 0, charts: 8, tables: 4, maps: 0, total: 49 },
    dashboardTitle: 'Safety & Security',
    period: 'Last 24 hours',
  },
  {
    id: 'hw-status',
    title: 'HW Status Dashboard',
    focus: 'Device telematics health',
    reportType: 'hardware',
    description:
      'Fleet-wide hardware: movement state, connectivity, sensor readings, boolean sensors, and last 20 events per device.',
    categories: ['Hardware', 'Live status'],
    kpiHighlights: [
      'Moving / Stopped / Parked',
      'Online / Offline / Standby',
      'No Signal',
      'Registered Objects',
    ],
    panelCounts: { kpi: 8, stat: 0, charts: 4, tables: 4, maps: 0, total: 20 },
    dashboardTitle: 'HW Status Dashboard',
    period: 'Last 72 hours',
  },
  {
    id: 'driver-performance',
    title: 'Driving Score Dashboard',
    focus: '0–100 driving score',
    reportType: 'driver-behavior',
    description:
      'Composite driving score per vehicle, violation type breakdown, and detailed violation log tables.',
    categories: ['Driver scoring', 'Safety'],
    kpiHighlights: [
      'Avg Driving Score',
      'Total Vehicles',
      'Total Events',
      'Violation Breakdown',
    ],
    panelCounts: { kpi: 3, stat: 0, charts: 0, tables: 3, maps: 0, total: 9 },
    dashboardTitle: 'Driving Score Dashboard',
    period: 'Last month',
  },
  {
    id: 'behavior-impact',
    title: 'Behavior Impact Dashboard',
    focus: 'Weekly behavior trends',
    reportType: 'driver-behavior',
    description:
      'Idling, aggressive driving, high RPM (>5000), and high-speed trips with week-over-week trends and route comparison.',
    categories: ['Behavior', 'Safety'],
    kpiHighlights: [
      'Idling Events (7d)',
      'Aggressive Driving (7d)',
      'High RPM >5000 (7d)',
      'High Speed Trips (7d)',
    ],
    panelCounts: { kpi: 4, stat: 0, charts: 5, tables: 1, maps: 0, total: 13 },
    dashboardTitle: 'Behavior Impact Dashboard',
    period: 'Last 7 days',
  },
  {
    id: 'hw-asset-detail',
    title: 'HW Asset Detail',
    focus: 'Single-asset drill-down',
    reportType: 'hardware',
    description:
      'Per-asset view: geomap, alarm state, sensor timeseries, boolean sensor activity, and last 20 telemetry events.',
    categories: ['Hardware', 'Live status'],
    kpiHighlights: [
      'Asset Geomap',
      'Sensor Timeseries',
      'Boolean Sensors',
      'Recent Telemetry Events',
    ],
    panelCounts: { kpi: 0, stat: 0, charts: 3, tables: 3, maps: 1, total: 7 },
    dashboardTitle: 'HW Asset Detail Dashboard',
    period: 'Last 24 hours',
  },
];

const TEMPLATE_MAP = new Map(ONBOARDING_TEMPLATES.map((t) => [t.id, t]));

export function getTemplateById(id: string): OnboardingTemplate | undefined {
  return TEMPLATE_MAP.get(id);
}

export function getTemplatesForRole(roleId: OnboardingRoleId): OnboardingTemplate[] {
  const order = ROLE_TEMPLATE_ORDER[roleId] ?? ALL_TEMPLATE_IDS;
  return order
    .map((id) => TEMPLATE_MAP.get(id))
    .filter((t): t is OnboardingTemplate => t != null);
}

export function getRecommendedTemplatesForRole(roleId: OnboardingRoleId): OnboardingTemplate[] {
  return getTemplatesForRole(roleId).slice(0, 3);
}

export function isRecommendedTemplate(roleId: OnboardingRoleId, templateId: string): boolean {
  const order = ROLE_TEMPLATE_ORDER[roleId] ?? [];
  return order.slice(0, 3).includes(templateId);
}

export function getTemplatesGroupedByReportType(
  roleId: OnboardingRoleId,
  typeFilter: ReportTypeId | 'all'
): Array<{ type: ReportTypeMeta; templates: OnboardingTemplate[] }> {
  const ordered = getTemplatesForRole(roleId);
  const byType = new Map<ReportTypeId, OnboardingTemplate[]>();

  for (const template of ordered) {
    if (typeFilter !== 'all' && template.reportType !== typeFilter) continue;
    const list = byType.get(template.reportType) ?? [];
    list.push(template);
    byType.set(template.reportType, list);
  }

  return REPORT_TYPES
    .filter((rt) => typeFilter === 'all' || rt.id === typeFilter)
    .filter((rt) => byType.has(rt.id))
    .map((rt) => ({ type: rt, templates: byType.get(rt.id)! }));
}

export function countMetrics(panelCounts: OnboardingTemplate['panelCounts']): number {
  return panelCounts.kpi + panelCounts.stat;
}

export const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  'Fleet overview': 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  Safety: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'Safety & security': 'bg-red-500/15 text-red-700 dark:text-red-300',
  Trips: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  Mileage: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'Live status': 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  Hardware: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  'Engine & workload': 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  'Finance & leasing': 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  Geofencing: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  Anomalies: 'bg-red-500/15 text-red-700 dark:text-red-300',
  'Driver scoring': 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  Behavior: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
};
