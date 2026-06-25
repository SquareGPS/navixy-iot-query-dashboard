import type { Dashboard, Panel } from '@/types/dashboard-types';
import { makeMultiselectVariable } from '@/utils/filterVariables';
import type { ObjectScopeId } from './types';

interface ScopeFilterConfig {
  filterName: string;
  label: string;
  primaryColumn: string;
  matchColumns: string[];
  /** Fast master-data query when panels do not expose the column. */
  discoveryQuery: string;
}

const SCOPE_FILTER_CONFIG: Record<
  Exclude<ObjectScopeId, 'all-vehicles'>,
  ScopeFilterConfig
> = {
  group: {
    filterName: 'object_group',
    label: 'Group',
    primaryColumn: 'group_label',
    matchColumns: ['group_label', 'group_name'],
    discoveryQuery:
      'SELECT DISTINCT group_label FROM raw_business_data.groups WHERE group_label IS NOT NULL ORDER BY 1 LIMIT 500',
  },
  department: {
    filterName: 'department',
    label: 'Department',
    primaryColumn: 'department_label',
    matchColumns: ['department_label'],
    discoveryQuery:
      'SELECT DISTINCT department_label FROM raw_business_data.departments WHERE department_label IS NOT NULL ORDER BY 1 LIMIT 500',
  },
  geozone: {
    filterName: 'geozone',
    label: 'Geozone',
    primaryColumn: 'zone_label',
    matchColumns: ['zone_label', 'zone_name', 'zone'],
    discoveryQuery:
      'SELECT DISTINCT zone_label FROM raw_business_data.zones WHERE zone_label IS NOT NULL ORDER BY 1 LIMIT 500',
  },
  garage: {
    filterName: 'garage',
    label: 'Garage',
    primaryColumn: 'garage_label',
    matchColumns: ['garage_label', 'zone_label', 'zone_name'],
    discoveryQuery:
      'SELECT DISTINCT garage_label FROM raw_business_data.garages WHERE garage_label IS NOT NULL ORDER BY 1 LIMIT 500',
  },
};

function asPanels(schema: Record<string, unknown>): Panel[] {
  return (schema.panels as Panel[] | undefined) ?? [];
}

function visitPanels(panels: Panel[], visitor: (panel: Panel) => void): void {
  for (const panel of panels) {
    visitor(panel);
    if (panel.panels?.length) visitPanels(panel.panels, visitor);
  }
}

/** Infer output column names when dataset.columns is empty in the schema. */
function inferOutputColumns(panel: Panel): string[] {
  const declared = panel['x-navixy']?.dataset?.columns;
  if (declared && Object.keys(declared).length > 0) {
    return Object.keys(declared);
  }

  const sql = panel['x-navixy']?.sql?.statement ?? '';
  const cols = new Set<string>();
  for (const match of sql.matchAll(/\bAS\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
    cols.add(match[1]);
  }
  return [...cols];
}

/** Panels whose query output includes a scope column (group_label, zone_label, etc.). */
export function findScopePanelMatches(
  panels: Panel[],
  matchColumns: string[]
): Array<{ panel: Panel; column: string }> {
  const hits: Array<{ panel: Panel; column: string }> = [];
  visitPanels(panels, (panel) => {
    const hasSql = panel['x-navixy']?.sql?.statement;
    if (!hasSql) return;
    const outputCols = inferOutputColumns(panel);
    const column = matchColumns.find((name) => outputCols.includes(name));
    if (column) hits.push({ panel, column });
  });
  return hits;
}

function bindScopeFilterToPanels(
  panels: Panel[],
  variableName: string,
  matchColumns: string[]
): Panel[] {
  const mapPanel = (panel: Panel): Panel => {
    const newChildren = panel.panels?.map(mapPanel);
    const childChanged =
      !!newChildren && newChildren.some((child, i) => child !== panel.panels![i]);

    const hasSql = panel['x-navixy']?.sql?.statement;
    const matchedColumn = hasSql
      ? matchColumns.find((name) => inferOutputColumns(panel).includes(name))
      : undefined;

    let filters = panel['x-navixy']?.filters ?? [];
    const existingIdx = filters.findIndex((f) => f.variable === variableName);
    let changed = false;

    if (matchedColumn) {
      if (existingIdx >= 0) {
        if (filters[existingIdx].column !== matchedColumn) {
          filters = filters.map((f, i) =>
            i === existingIdx ? { ...f, column: matchedColumn } : f
          );
          changed = true;
        }
      } else {
        filters = [...filters, { variable: variableName, column: matchedColumn }];
        changed = true;
      }
    } else if (existingIdx >= 0) {
      filters = filters.filter((f) => f.variable !== variableName);
      changed = true;
    }

    if (!changed && !childChanged) return panel;

    const next: Panel = { ...panel };
    if (childChanged) next.panels = newChildren;
    if (changed) next['x-navixy'] = { ...panel['x-navixy'], filters };
    return next;
  };

  return panels.map(mapPanel);
}

function buildScopeDiscoveryQuery(config: ScopeFilterConfig): string {
  // Wizard scope filters always use fast master-data discovery. Panel SQL unions
  // are too heavy at dashboard open and often reference columns absent from output.
  return config.discoveryQuery;
}

/**
 * When the wizard picks a grouping scope (group, department, geozone, garage),
 * add a multiselect filter to templating.list and wire matching panels so the
 * control appears in Parameters and applies at query time via applyPanelFilters.
 */
export function applyScopeFilterToSchema(
  schema: Record<string, unknown>,
  scope: ObjectScopeId
): Record<string, unknown> {
  if (scope === 'all-vehicles') {
    return schema;
  }

  const config = SCOPE_FILTER_CONFIG[scope];
  const panels = asPanels(schema);
  const matches = findScopePanelMatches(panels, config.matchColumns);
  const source = matches[0]?.panel;
  const discoveryQuery = buildScopeDiscoveryQuery(config);

  const variable = makeMultiselectVariable({
    name: config.filterName,
    label: config.label,
    column: config.primaryColumn,
    query: discoveryQuery,
    ...(source?.id !== undefined && source.id !== null ? { panelId: source.id } : {}),
    ...(source?.title ? { panelTitle: source.title } : {}),
    ...(matches.length > 0
      ? { panels: matches.map(({ panel }) => ({ id: panel.id, title: panel.title })) }
      : {}),
  });

  const existingTemplating = (schema.templating as Record<string, unknown> | undefined) ?? {};
  const existingList = Array.isArray(existingTemplating.list)
    ? [...(existingTemplating.list as unknown[])]
    : [];

  const withoutScope = existingList.filter(
    (item) =>
      (item as { name?: string }).name !== config.filterName &&
      (item as { name?: string }).name !== 'wizard_scope'
  );

  const boundPanels = bindScopeFilterToPanels(panels, config.filterName, config.matchColumns);

  return {
    ...schema,
    panels: boundPanels,
    templating: {
      ...existingTemplating,
      enable: true,
      list: [...withoutScope, variable],
    },
  };
}

export function getScopeFilterLabel(scope: ObjectScopeId): string | null {
  if (scope === 'all-vehicles') return null;
  return SCOPE_FILTER_CONFIG[scope].label;
}

/**
 * Repair wizard scope filter variables saved with outdated discovery SQL
 * (e.g. departments table without is_deleted, heavy panel unions) and ensure
 * panel filter bindings exist so Apply/Update applies selections to widgets.
 */
export function normalizeWizardScopeFilters(dashboard: Dashboard): Dashboard {
  const list = dashboard.templating?.list ?? [];

  let nextList = list;
  let listChanged = false;

  nextList = list.map((variable) => {
    if (variable['x-navixy']?.control !== 'multiselect') return variable;

    const config = Object.values(SCOPE_FILTER_CONFIG).find(
      (c) => c.filterName === variable.name
    );
    if (!config) return variable;

    const queryStale =
      variable.query !== config.discoveryQuery ||
      (variable.query?.includes('is_deleted') ?? false);
    const columnStale = variable['x-navixy']?.column !== config.primaryColumn;
    if (!queryStale && !columnStale) return variable;

    listChanged = true;
    return {
      ...variable,
      query: config.discoveryQuery,
      'x-navixy': {
        ...variable['x-navixy'],
        column: config.primaryColumn,
      },
    };
  });

  let nextPanels = dashboard.panels;
  let panelsChanged = false;

  for (const config of Object.values(SCOPE_FILTER_CONFIG)) {
    if (!nextList.some((v) => v.name === config.filterName)) continue;

    const rebound = bindScopeFilterToPanels(
      nextPanels,
      config.filterName,
      config.matchColumns
    );
    const filtersSignature = (panels: Panel[]) =>
      JSON.stringify(
        panels.map((p) => ({
          id: p.id,
          filters: p['x-navixy']?.filters ?? [],
        }))
      );
    if (filtersSignature(rebound) !== filtersSignature(nextPanels)) {
      nextPanels = rebound;
      panelsChanged = true;
    }

    const matches = findScopePanelMatches(nextPanels, config.matchColumns);
    if (matches.length > 0) {
      const panelsMeta = matches.map(({ panel }) => ({
        id: panel.id,
        title: panel.title,
      }));
      const source = matches[0].panel;
      nextList = nextList.map((v) => {
        if (v.name !== config.filterName) return v;
        const nav = v['x-navixy'] ?? {};
        const panelsJson = JSON.stringify(nav.panels ?? []);
        const metaJson = JSON.stringify(panelsMeta);
        if (panelsJson === metaJson) return v;
        listChanged = true;
        return {
          ...v,
          'x-navixy': {
            ...nav,
            panels: panelsMeta,
            ...(source.id !== undefined && source.id !== null
              ? { panelId: source.id }
              : {}),
            ...(source.title ? { panelTitle: source.title } : {}),
          },
        };
      });
    }
  }

  if (!listChanged && !panelsChanged) return dashboard;

  return {
    ...dashboard,
    panels: nextPanels,
    templating: {
      ...dashboard.templating!,
      list: nextList,
      enable: dashboard.templating?.enable ?? true,
    },
  };
}
