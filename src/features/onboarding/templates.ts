import type { OnboardingRole } from './types';
import {
  getMetricPanelGroups,
  getMetricPanelsFromGroups,
} from './schemaMetrics';

import fleetPerformanceSchema from '@schemas/02-fleet-performance-dashboard-schema.json';
import fleetAnomalySchema from '@schemas/01-fleet-anomaly-monitor-schema.json';
import fleetReportsSchema from '@schemas/03-fleet-reports-dashboard-schema.json';
import tripOperationsSchema from '@schemas/04-hm-trip-operations-dashboard-schema.json';
import engineOperationSchema from '@schemas/05-heavy-machinery-engine-operation-schema.json';
import leasingSchema from '@schemas/06-leasing-dashboard-schema.json';
import objectStatusSchema from '@schemas/07-object-status-dashboard-schema.json';
import tripsYesterdaySchema from '@schemas/08-trips-dashboard-yesterday-schema.json';
import vehicleMileageSchema from '@schemas/09-vehicle-mileage-dashboard-schema.json';
import premiumSafetySchema from '@schemas/10-premium-safety-security-dashboard-schema.json';
import hwStatusSchema from '@schemas/11-hw-status-dashboard-schema.json';
import driverPerformanceSchema from '@schemas/12-driver-performance-dashboard-schema.json';
import behaviorImpactSchema from '@schemas/13-behavior-impact-dashboard-schema.json';
import hwAssetDetailSchema from '@schemas/14-hw-asset-detail-dashboard-schema.json';

export const ONBOARDING_ROLES: OnboardingRole[] = [
  {
    id: 'fleet-manager',
    title: 'Fleet Manager',
    description: 'Monitor fleet health, utilization, and performance KPIs',
  },
  {
    id: 'operations-manager',
    title: 'Operations Manager',
    description: 'Oversee daily operations and trip execution',
  },
  {
    id: 'dispatcher',
    title: 'Dispatcher',
    description: 'Track trips, routes, and real-time dispatch status',
  },
  {
    id: 'maintenance-manager',
    title: 'Maintenance Manager',
    description: 'Monitor engine hours, faults, and service intervals',
  },
  {
    id: 'finance-manager',
    title: 'Finance Manager',
    description: 'Analyze leasing costs and financial fleet metrics',
  },
  {
    id: 'partner-admin',
    title: 'Partner Admin',
    description: 'Manage multi-tenant fleet visibility for partners',
  },
];

const METRIC_PANEL_TYPES = new Set(['kpi', 'stat']);

const TEMPLATE_SCHEMAS: Record<string, Record<string, unknown>> = {
  'fleet-performance': fleetPerformanceSchema as Record<string, unknown>,
  'fleet-anomaly': fleetAnomalySchema as Record<string, unknown>,
  'fleet-reports': fleetReportsSchema as Record<string, unknown>,
  'trip-operations': tripOperationsSchema as Record<string, unknown>,
  'engine-operation': engineOperationSchema as Record<string, unknown>,
  leasing: leasingSchema as Record<string, unknown>,
  'object-status': objectStatusSchema as Record<string, unknown>,
  'trips-yesterday': tripsYesterdaySchema as Record<string, unknown>,
  'vehicle-mileage': vehicleMileageSchema as Record<string, unknown>,
  'premium-safety-security': premiumSafetySchema as Record<string, unknown>,
  'hw-status': hwStatusSchema as Record<string, unknown>,
  'driver-performance': driverPerformanceSchema as Record<string, unknown>,
  'behavior-impact': behaviorImpactSchema as Record<string, unknown>,
  'hw-asset-detail': hwAssetDetailSchema as Record<string, unknown>,
};

export function getTemplateSchema(templateId: string): Record<string, unknown> {
  const schema = TEMPLATE_SCHEMAS[templateId];
  if (!schema) {
    throw new Error(`Unknown onboarding template: ${templateId}`);
  }
  return structuredClone(schema);
}

export function getMetricPanels(
  schema: Record<string, unknown>
): Array<{ id: number; title: string; type: string }> {
  return getMetricPanelsFromGroups(getMetricPanelGroups(schema));
}

export function getMetricGroups(schema: Record<string, unknown>) {
  return getMetricPanelGroups(schema);
}

/** @deprecated use getMetricPanels */
export function getKpiPanels(schema: Record<string, unknown>): Array<{ id: number; title: string }> {
  return getMetricPanels(schema).map(({ id, title }) => ({ id, title }));
}

export function filterSchemaMetrics(
  schema: Record<string, unknown>,
  selectedMetricIds: number[]
): Record<string, unknown> {
  const panels = schema.panels as Array<{ id?: number; type?: string }> | undefined;
  if (!panels) return schema;

  const selected = new Set(selectedMetricIds);
  const filteredPanels = panels.filter(
    (panel) =>
      !panel.type ||
      !METRIC_PANEL_TYPES.has(panel.type) ||
      (panel.id != null && selected.has(panel.id))
  );

  return {
    ...schema,
    panels: filteredPanels,
  };
}

/** @deprecated use filterSchemaMetrics */
export function filterSchemaKpis(
  schema: Record<string, unknown>,
  selectedKpiIds: number[]
): Record<string, unknown> {
  return filterSchemaMetrics(schema, selectedKpiIds);
}

export function wrapReportSchema(
  flatSchema: Record<string, unknown>,
  title: string
): Record<string, unknown> {
  const uid = `onboarding_${Date.now()}`;
  return {
    ...flatSchema,
    title,
    uid,
    tags: [...((flatSchema.tags as string[] | undefined) ?? []), 'onboarding'],
  };
}
