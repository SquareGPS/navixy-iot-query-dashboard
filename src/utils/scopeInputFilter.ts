/**
 * Wizard scope multiselect filters (Group, Department, …) are wired to panel
 * OUTPUT columns via applyPanelFilters. KPI / stat panels that aggregate fleet
 * totals do not project those columns, so we inject scope constraints into the
 * underlying SQL (objects / trips) at execution time.
 */
import type { Dashboard, PanelFilterBinding } from '@/types/dashboard-types';

interface ScopeInputRule {
  variableName: string;
  /** EXISTS clause referencing `objects` row alias `o` and `${paramName}`. */
  existsOnObject: (paramName: string) => string;
}

const SCOPE_INPUT_RULES: ScopeInputRule[] = [
  {
    variableName: 'object_group',
    existsOnObject: (p) =>
      `EXISTS (SELECT 1 FROM raw_business_data.groups _navixy_g WHERE _navixy_g.group_id = o.group_id AND _navixy_g.group_label::text = ANY(\${${p}}::text[]))`,
  },
  {
    variableName: 'department',
    existsOnObject: (p) =>
      `EXISTS (SELECT 1 FROM raw_business_data.employees _navixy_e JOIN raw_business_data.departments _navixy_d ON _navixy_d.department_id = _navixy_e.department_id WHERE _navixy_e.object_id = o.object_id AND _navixy_e.is_deleted IS NOT TRUE AND _navixy_d.department_label::text = ANY(\${${p}}::text[]))`,
  },
  {
    variableName: 'geozone',
    existsOnObject: (p) =>
      `EXISTS (SELECT 1 FROM processed_common_data.zone_visits _navixy_zv JOIN raw_business_data.zones _navixy_z ON _navixy_z.zone_id = _navixy_zv.zone_id WHERE _navixy_zv.device_id = o.device_id AND _navixy_z.zone_label::text = ANY(\${${p}}::text[]))`,
  },
  {
    variableName: 'garage',
    existsOnObject: (p) =>
      `EXISTS (SELECT 1 FROM raw_business_data.garages _navixy_ga WHERE _navixy_ga.garage_id = o.garage_id AND _navixy_ga.garage_label::text = ANY(\${${p}}::text[]))`,
  },
];

const OBJECT_LABELS_FILTER_TAIL =
  /(\(tp\.object_labels_filter\s+IS\s+NULL\s+OR\s+o\.object_label\s*=\s*ANY\(tp\.object_labels_filter\)\))/gi;

const OBJECTS_IS_DELETED =
  /(\bo\.is_deleted\s+IS\s+NOT\s+TRUE\b|\bo\.is_deleted\s+is\s+FALSE\b|\bo\.is_deleted\s+IS\s+NOT\s+true\b|\bo\.is_deleted\s+IS\s+FALSE\b)/gi;

function hasActiveSelection(values: Record<string, unknown>, variableName: string): boolean {
  const selection = values[variableName];
  return Array.isArray(selection) && selection.length > 0;
}

function appendAndClause(statement: string, clause: string): string {
  if (statement.includes(clause)) return statement;

  const tailMatch = statement.match(/\s+(GROUP\s+BY|ORDER\s+BY|LIMIT)\b/i);
  const splitAt = tailMatch?.index ?? statement.length;
  const head = statement.slice(0, splitAt);
  const tail = statement.slice(splitAt);

  if (!/\bWHERE\b/i.test(head)) {
    return head.trimEnd() + ` WHERE 1=1 ${clause}` + tail;
  }
  return head.trimEnd() + clause + tail;
}

function injectOnObjects(statement: string, existsClause: string): string {
  const andExists = ` AND ${existsClause}`;
  if (statement.includes(existsClause)) return statement;

  if (OBJECT_LABELS_FILTER_TAIL.test(statement)) {
    OBJECT_LABELS_FILTER_TAIL.lastIndex = 0;
    return statement.replace(OBJECT_LABELS_FILTER_TAIL, (m) => m + andExists);
  }

  OBJECTS_IS_DELETED.lastIndex = 0;
  if (OBJECTS_IS_DELETED.test(statement)) {
    OBJECTS_IS_DELETED.lastIndex = 0;
    return statement.replace(OBJECTS_IS_DELETED, (m) => m + andExists);
  }

  return statement;
}

function injectOnTrips(statement: string, existsClause: string): string {
  const deviceFilter = ` AND t.device_id IN (SELECT o.device_id FROM raw_business_data.objects o WHERE o.is_deleted IS NOT TRUE AND ${existsClause})`;
  if (statement.includes(deviceFilter.trim())) return statement;
  if (!/\bprocessed_common_data\.trips\b/i.test(statement)) return statement;
  return appendAndClause(statement, deviceFilter);
}

/**
 * Apply wizard scope multiselect selections inside panel SQL when the panel has
 * no output-column binding for that variable (KPI / stat / fleet aggregates).
 */
export function applyWizardScopeInputFilters(
  statement: string,
  dashboard: Dashboard | null | undefined,
  values: Record<string, unknown> | undefined,
  panelBindings: PanelFilterBinding[] | undefined
): string {
  if (!dashboard?.templating?.list || !values) return statement;

  let result = statement;

  for (const rule of SCOPE_INPUT_RULES) {
    const variable = dashboard.templating.list.find((v) => v.name === rule.variableName);
    if (!variable || variable['x-navixy']?.control !== 'multiselect') continue;
    if (!hasActiveSelection(values, rule.variableName)) continue;
    if (panelBindings?.some((b) => b.variable === rule.variableName)) continue;
    if (result.includes(`\${${rule.variableName}}`)) continue;

    const existsClause = rule.existsOnObject(rule.variableName);

    if (/\braw_business_data\.objects\b/i.test(result)) {
      result = injectOnObjects(result, existsClause);
    } else {
      result = injectOnTrips(result, existsClause);
    }
  }

  return result;
}
