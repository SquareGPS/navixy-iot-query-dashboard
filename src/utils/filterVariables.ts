/**
 * Local filter variables (dashboard.templating.list[])
 *
 * Shared helpers for the local filter controls rendered in the parameter bar.
 *
 * Type 1 — Date range filter: a `custom` template variable carrying
 *   `x-navixy.control: 'daterange'`. It stores its default range as
 *   `current.value = [fromExpr, toExpr]` and exposes two bindable SQL
 *   parameters, `${<name>_from}` and `${<name>_to}`, analogous to the global
 *   `${__from}` / `${__to}` timepicker bindings. Panel authors opt a panel into
 *   the filter by referencing those parameters in the panel SQL.
 */
import type { Dashboard, Variable, PanelFilterBinding, Panel } from '@/types/dashboard-types';

export interface DateRangePreset {
  id: string;
  display: string;
  from: string;
  to: string;
}

/** Presets offered for date-range filters (defaults in the manager + runtime quick ranges). */
export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { id: 'today', display: 'Today', from: 'now/d', to: 'now' },
  { id: 'yesterday', display: 'Yesterday', from: 'now-1d/d', to: 'now/d' },
  { id: 'last7d', display: 'Last 7 days', from: 'now-7d/d', to: 'now' },
  { id: 'last30d', display: 'Last 30 days', from: 'now-30d/d', to: 'now' },
  { id: 'last90d', display: 'Last 90 days', from: 'now-90d/d', to: 'now' },
  { id: 'thisMonth', display: 'This month', from: 'now/M', to: 'now' },
];

/** Default range used when a variable has no stored value. */
export const DEFAULT_DATE_RANGE: DateRangePreset = DATE_RANGE_PRESETS[2]; // Last 7 days

/** Return the date-range filter variables declared on a dashboard. */
export function getDateRangeFilters(dashboard: Dashboard | null | undefined): Variable[] {
  return (dashboard?.templating?.list ?? []).filter(
    (v) => v['x-navixy']?.control === 'daterange'
  );
}

/** Derived SQL parameter names a date-range filter binds to. */
export function dateRangeParamNames(name: string): { from: string; to: string } {
  return { from: `${name}_from`, to: `${name}_to` };
}

/** Read the default [from, to] expressions stored on a date-range variable. */
export function dateRangeDefaults(variable: Variable): { from: string; to: string } {
  const value = variable.current?.value;
  if (Array.isArray(value) && value.length === 2) {
    return { from: value[0], to: value[1] };
  }
  return { from: DEFAULT_DATE_RANGE.from, to: DEFAULT_DATE_RANGE.to };
}

/**
 * Validate a filter variable name. Must be a SQL-identifier-safe token and must
 * not shadow the reserved global time bindings (`__from` / `__to`).
 */
export function isValidFilterName(name: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) && !name.startsWith('__');
}

/** Suggest a SQL-safe variable name from a human label. */
export function suggestFilterName(label: string): string {
  let base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!/^[a-z]/.test(base)) {
    base = `f_${base}`.replace(/_+$/g, '');
  }
  return base || 'filter';
}

/** Build a date-range filter variable for templating.list[]. */
export function makeDateRangeVariable(params: {
  name: string;
  label: string;
  from: string;
  to: string;
  text: string;
}): Variable {
  return {
    type: 'custom',
    name: params.name,
    label: params.label,
    current: { value: [params.from, params.to], text: params.text },
    'x-navixy': { control: 'daterange' },
  };
}

/** Double-quote a SQL identifier, escaping embedded quotes. */
function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Apply a panel's local filter bindings to its SQL by wrapping the original
 * statement as a subquery and filtering on the chosen output columns:
 *
 *   SELECT * FROM ( <original> ) AS _navixy_filter
 *   WHERE "col" BETWEEN ${var_from} AND ${var_to}
 *
 * Wrapping is the one rewrite valid for ANY SELECT (CTEs, joins, aggregates), so
 * we never parse or splice the user's query. It is non-destructive — the stored
 * statement is unchanged; this runs at execution time. The chosen column is a
 * result/output column, so the filter restricts the rows the panel would show.
 *
 * Returns the original statement unchanged when there are no applicable bindings.
 */
export function applyPanelFilters(
  statement: string,
  filters: PanelFilterBinding[] | undefined,
  dashboard: Dashboard | null | undefined
): string {
  if (!filters || filters.length === 0) return statement;

  const clauses: string[] = [];
  for (const binding of filters) {
    if (!binding.column) continue;
    const variable = dashboard?.templating?.list?.find((v) => v.name === binding.variable);
    if (variable?.['x-navixy']?.control === 'daterange') {
      const names = dateRangeParamNames(binding.variable);
      clauses.push(
        `${quoteIdentifier(binding.column)} BETWEEN \${${names.from}} AND \${${names.to}}`
      );
    }
  }

  if (clauses.length === 0) return statement;

  const inner = statement.trim().replace(/;\s*$/, '');
  return `SELECT * FROM (\n${inner}\n) AS _navixy_filter\nWHERE ${clauses.join(' AND ')}`;
}

export interface ActivePanelFilter {
  variable: string;
  label: string;
  column: string;
}

/**
 * Resolve a panel's active local filter bindings — those whose column is set and
 * whose variable still exists as a date-range filter. Mirrors applyPanelFilters
 * exactly, so a UI indicator built on this shows precisely when a filter is
 * actually applied to the query.
 */
export function getActivePanelFilters(
  panel: Panel,
  dashboard: Dashboard | null | undefined
): ActivePanelFilter[] {
  const filters = panel['x-navixy']?.filters;
  if (!filters || filters.length === 0) return [];

  const active: ActivePanelFilter[] = [];
  for (const binding of filters) {
    if (!binding.column) continue;
    const variable = dashboard?.templating?.list?.find((v) => v.name === binding.variable);
    if (variable?.['x-navixy']?.control === 'daterange') {
      active.push({
        variable: binding.variable,
        label: variable.label || variable.name,
        column: binding.column,
      });
    }
  }
  return active;
}
