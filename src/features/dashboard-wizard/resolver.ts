import { getTemplateById } from '@/features/onboarding/templateCatalog';
import {
  getMetricPanels,
  getTemplateSchema,
  filterSchemaMetrics,
  wrapReportSchema,
} from '@/features/onboarding/templates';
import { repackFlatReportSchema } from '@/features/onboarding/repackSchema';
import { WIZARD_KPIS, GOAL_TEMPLATE_PRIORITY, getScopeLabel } from './catalog';
import { applyScopeFilterToSchema } from './scopeFilter';
import type {
  BusinessGoalId,
  WizardKpiId,
  WizardResolution,
  WizardSelection,
} from './types';

function metricMatchesKpi(metricTitle: string, kpiId: WizardKpiId): boolean {
  const kpi = WIZARD_KPIS.find((k) => k.id === kpiId);
  if (!kpi) return false;
  const lower = metricTitle.toLowerCase();
  return kpi.titlePatterns.some((p) => lower.includes(p.toLowerCase()));
}

export function matchMetricsForKpis(
  schema: Record<string, unknown>,
  kpiIds: WizardKpiId[]
): { metricIds: number[]; matchedKpiIds: WizardKpiId[] } {
  const metrics = getMetricPanels(schema);
  const metricIds: number[] = [];
  const matchedKpiIds: WizardKpiId[] = [];

  for (const kpiId of kpiIds) {
    const matched = metrics.filter((m) => metricMatchesKpi(m.title, kpiId));
    if (matched.length > 0) {
      matchedKpiIds.push(kpiId);
      metricIds.push(...matched.map((m) => m.id));
    }
  }

  return { metricIds: [...new Set(metricIds)], matchedKpiIds };
}

export function resolveWizardTemplate(selection: WizardSelection): WizardResolution {
  const candidates = GOAL_TEMPLATE_PRIORITY[selection.goal] ?? [];
  let best: WizardResolution | null = null;

  for (const templateId of candidates) {
    const meta = getTemplateById(templateId);
    if (!meta) continue;

    const schema = getTemplateSchema(templateId);
    const { metricIds, matchedKpiIds } = matchMetricsForKpis(schema, selection.kpis);
    const score = metricIds.length;

    const resolution: WizardResolution = {
      templateId,
      templateTitle: meta.title,
      dashboardTitle: buildDashboardTitle(selection, meta.dashboardTitle),
      matchedMetricIds: metricIds,
      matchedKpiLabels: matchedKpiIds.map(
        (id) => WIZARD_KPIS.find((k) => k.id === id)?.label ?? id
      ),
      score,
    };

    if (!best || score > best.score) {
      best = resolution;
    }
    if (score >= selection.kpis.length) break;
  }

  if (!best) {
    const fallbackId = 'fleet-performance';
    const meta = getTemplateById(fallbackId)!;
    const schema = getTemplateSchema(fallbackId);
    const { metricIds, matchedKpiIds } = matchMetricsForKpis(schema, selection.kpis);
    best = {
      templateId: fallbackId,
      templateTitle: meta.title,
      dashboardTitle: buildDashboardTitle(selection, meta.dashboardTitle),
      matchedMetricIds: metricIds,
      matchedKpiLabels: matchedKpiIds.map(
        (id) => WIZARD_KPIS.find((k) => k.id === id)?.label ?? id
      ),
      score: metricIds.length,
    };
  }

  return best;
}

function buildDashboardTitle(selection: WizardSelection, baseTitle: string): string {
  const scopeSuffix =
    selection.scope === 'all-vehicles' ? '' : ` · ${getScopeLabel(selection.scope)}`;
  return `${baseTitle}${scopeSuffix}`;
}

export function buildWizardReportSchema(
  resolution: WizardResolution,
  selection: WizardSelection
): Record<string, unknown> {
  const schema = getTemplateSchema(resolution.templateId);
  const metrics = getMetricPanels(schema);

  let body: Record<string, unknown>;
  if (metrics.length > 0 && resolution.matchedMetricIds.length > 0) {
    body = filterSchemaMetrics(schema, resolution.matchedMetricIds);
    const originalCount = (schema.panels as unknown[] | undefined)?.length ?? 0;
    const filteredCount = (body.panels as unknown[] | undefined)?.length ?? 0;
    if (filteredCount < originalCount) {
      body = repackFlatReportSchema(body);
    }
  } else {
    body = schema;
  }

  const wrapped = wrapReportSchema(body, resolution.dashboardTitle);

  return applyWizardMetadata(wrapped, selection, resolution);
}

function applyWizardMetadata(
  schema: Record<string, unknown>,
  selection: WizardSelection,
  resolution: WizardResolution
): Record<string, unknown> {
  const existingNavixy = (schema['x-navixy'] as Record<string, unknown>) ?? {};
  const tags = [...((schema.tags as string[] | undefined) ?? []), 'dashboard-wizard'];

  const withMetadata = {
    ...schema,
    tags,
    description:
      `Created via Dashboard Wizard · Goal: ${selection.goal} · Scope: ${selection.scope} · KPIs: ${selection.kpis.join(', ')}`,
    'x-navixy': {
      ...existingNavixy,
      wizard: {
        goal: selection.goal,
        scope: selection.scope,
        kpis: selection.kpis,
        templateId: resolution.templateId,
        matchedKpis: resolution.matchedKpiLabels,
      },
    },
  };

  return applyScopeFilterToSchema(withMetadata, selection.scope);
}
