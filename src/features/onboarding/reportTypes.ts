import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  Cpu,
  Gauge,
  MapPin,
  Route,
  ShieldAlert,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import type { ReportTypeId } from './types';

export interface ReportTypeMeta {
  id: ReportTypeId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const REPORT_TYPES: ReportTypeMeta[] = [
  {
    id: 'fleet-overview',
    label: 'Fleet overview',
    description: 'Utilization, mileage, drivers, and consolidated ops reports',
    icon: Gauge,
    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  {
    id: 'safety-security',
    label: 'Safety & security',
    description: 'Premium safety, geofence, cargo, and SOS monitoring',
    icon: ShieldAlert,
    color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  },
  {
    id: 'trips',
    label: 'Trips & operations',
    description: 'Trip counts, durations, shifts, and yesterday drill-downs',
    icon: Route,
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'live-status',
    label: 'Live status',
    description: 'Online/offline, movement, and connectivity breakdowns',
    icon: MapPin,
    color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  },
  {
    id: 'hardware',
    label: 'Hardware & assets',
    description: 'Device health, engine workload, and single-asset drill-down',
    icon: Cpu,
    color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
  {
    id: 'mileage-finance',
    label: 'Mileage & finance',
    description: 'Mileage breakdown, leasing, idle time, and cost metrics',
    icon: Wallet,
    color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  },
  {
    id: 'driver-behavior',
    label: 'Driver behavior',
    description: 'Driving scores, idling, aggression, and behavior trends',
    icon: Users,
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  {
    id: 'anomalies',
    label: 'Anomalies',
    description: 'GPS loss, long stops, and abnormal geozone activity',
    icon: AlertTriangle,
    color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  },
];

export const REPORT_TYPE_MAP = new Map(REPORT_TYPES.map((t) => [t.id, t]));

export function getReportTypeMeta(id: ReportTypeId): ReportTypeMeta {
  return REPORT_TYPE_MAP.get(id)!;
}
