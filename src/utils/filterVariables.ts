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
import { parseTimeExpression, formatDateToISO } from '@/utils/timeParser';

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

// ── Type 2 — column-value (multiselect) filters ──────────────────────────────
// A multiselect filter is a query/custom variable carrying
// `x-navixy.control: 'multiselect'`. Its candidate values come from either a
// discovery query (`variable.query`, run at dashboard open) or a static list
// (`variable.options`). It exposes ONE bindable array param `${<name>}`, applied
// to a panel as `"col" = ANY(${<name>}::text[])`. An empty selection means "All"
// (no clause added), which is why array binding never needs an empty-array case.

/** Return the multiselect (column-value) filter variables on a dashboard. */
export function getMultiselectFilters(dashboard: Dashboard | null | undefined): Variable[] {
  return (dashboard?.templating?.list ?? []).filter(
    (v) => v['x-navixy']?.control === 'multiselect'
  );
}

/** Return all local filter variables (date-range + multiselect), in declared order. */
export function getLocalFilters(dashboard: Dashboard | null | undefined): Variable[] {
  return (dashboard?.templating?.list ?? []).filter((v) => {
    const c = v['x-navixy']?.control;
    return c === 'daterange' || c === 'multiselect';
  });
}

/** Static option values declared on a multiselect variable (empty if it uses a query). */
export function multiselectStaticOptions(variable: Variable): string[] {
  return (variable.options ?? []).map((o) => String(o.value));
}

/** The currently-selected values of a multiselect variable (its default selection). */
export function multiselectSelection(variable: Variable): string[] {
  const v = variable.current?.value;
  return Array.isArray(v) ? v.map(String) : [];
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

/** Build a multiselect (column-value) filter variable for templating.list[]. */
export function makeMultiselectVariable(params: {
  name: string;
  label: string;
  column?: string;
  panelId?: string | number;
  panelTitle?: string;
  panels?: Array<{ id?: string | number; title?: string }>;
  query?: string;
  staticValues?: string[];
}): Variable {
  const variable: Variable = {
    type: params.query ? 'query' : 'custom',
    name: params.name,
    label: params.label,
    multi: true,
    includeAll: true,
    current: { value: [], text: 'All' },
    'x-navixy': {
      control: 'multiselect',
      ...(params.column ? { column: params.column } : {}),
      ...(params.panelId !== undefined && params.panelId !== null ? { panelId: params.panelId } : {}),
      ...(params.panelTitle ? { panelTitle: params.panelTitle } : {}),
      ...(params.panels && params.panels.length > 0 ? { panels: params.panels } : {}),
    },
  };
  if (params.query) variable.query = params.query;
  if (params.staticValues && params.staticValues.length > 0) {
    variable.options = params.staticValues.map((val) => ({ text: val, value: val }));
  }
  return variable;
}

/** Match a panel against a recorded {id, title} reference (id wins, title falls back). */
function panelMatchesRef(
  panel: Panel,
  ref: { id?: string | number; title?: string }
): boolean {
  if (ref.id !== undefined && ref.id !== null && panel.id !== undefined && panel.id !== null) {
    return String(ref.id) === String(panel.id);
  }
  if (ref.title) return ref.title === panel.title;
  return false;
}

/**
 * Whether a local filter should be offered to / auto-applied on a panel. Date
 * filters apply to any panel. Value filters apply to every panel whose query
 * outputs their column (the set recorded on the variable at creation); older
 * variables that only recorded a single source panel match that panel, and
 * legacy ones with no panel info at all are offered everywhere.
 */
export function filterAppliesToPanel(variable: Variable, panel: Panel): boolean {
  const nav = variable['x-navixy'];
  if (nav?.control === 'daterange') return true;
  if (nav?.control !== 'multiselect') return false;
  if (nav.panels && nav.panels.length > 0) {
    return nav.panels.some((ref) => panelMatchesRef(panel, ref));
  }
  if ((nav.panelId !== undefined && nav.panelId !== null) || nav.panelTitle) {
    return panelMatchesRef(panel, { id: nav.panelId, title: nav.panelTitle });
  }
  return true;
}

/** The source/output column a multiselect filter targets (for pre-filling bindings). */
export function multiselectColumn(variable: Variable): string | undefined {
  return variable['x-navixy']?.column;
}

/**
 * Build an open-time discovery query for a column-value filter: the union of
 * the column's distinct values across every panel that outputs it, so the
 * option list covers all data the filter can apply to (not just the panel the
 * column was picked from). Values are cast to text so panels with differently
 * typed same-named columns still union cleanly.
 */
export function buildDiscoveryQuery(column: string, panelSqls: string[]): string {
  const q = quoteIdentifier(column);
  const inners = panelSqls.map(
    (sql, i) =>
      `SELECT ${q}::text AS _navixy_value FROM (\n${sql.trim().replace(/;\s*$/, '')}\n) AS _navixy_src_${i + 1}`
  );
  return `SELECT DISTINCT _navixy_value FROM (\n${inners.join('\nUNION\n')}\n) AS _navixy_values\nWHERE _navixy_value IS NOT NULL\nORDER BY 1`;
}

/** Resolve a dashboard's default time params (${__from}/${__to}) to ISO strings. */
export function defaultTimeParams(dashboard: Dashboard | null | undefined): Record<string, string> {
  const from = dashboard?.time?.from || 'now-24h';
  const to = dashboard?.time?.to || 'now';
  return {
    __from: formatDateToISO(parseTimeExpression(from)),
    __to: formatDateToISO(parseTimeExpression(to)),
  };
}

/**
 * Resolve a binding expression the way the dashboard renderer does at query
 * time: `${__from}`/`${__to}` against the default time range, `${name}` against
 * templating current values, then recursively against dashboard-level
 * x-navixy.parameters.bindings. Literals and unresolvable expressions are
 * returned as-is.
 */
function resolveBindingExpression(
  expr: string,
  dashboard: Dashboard | null | undefined,
  seen: Set<string> = new Set()
): unknown {
  const match = typeof expr === 'string' ? expr.match(/^\$\{([^}]+)\}$/) : null;
  if (!match) return expr;
  const name = match[1];
  if (seen.has(name)) return expr; // cycle guard
  seen.add(name);

  if (name === '__from' || name === '__to') {
    return defaultTimeParams(dashboard)[name];
  }
  const variable = dashboard?.templating?.list?.find((v) => v.name === name);
  if (variable?.current?.value !== undefined) {
    return variable.current.value;
  }
  const nested = dashboard?.['x-navixy']?.parameters?.bindings?.[name];
  if (nested !== undefined) {
    return resolveBindingExpression(nested, dashboard, seen);
  }
  return expr;
}

/**
 * Default parameter values for running a panel's SQL outside the live parameter
 * bar (column collection and option discovery). Mirrors executePanelQuery's
 * resolution order minus user-selected values: panel param defaults → panel
 * bindings → dashboard bindings → default time range → templating current
 * values. Callers should still strip unused params via filterUsedParameters.
 */
export function resolveDefaultPanelParams(
  dashboard: Dashboard | null | undefined,
  panel?: Panel
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const sql = panel?.['x-navixy']?.sql;

  // Panel param defaults (the params map can hold nulls and config scalars —
  // only honour real config objects with a default)
  if (sql?.params) {
    for (const [key, cfg] of Object.entries(sql.params as Record<string, unknown>)) {
      if (cfg && typeof cfg === 'object' && (cfg as { default?: unknown }).default !== undefined) {
        params[key] = (cfg as { default?: unknown }).default;
      }
    }
  }

  // Panel-level bindings, then dashboard-level bindings
  for (const bindings of [sql?.bindings, dashboard?.['x-navixy']?.parameters?.bindings]) {
    if (!bindings) continue;
    for (const [key, expr] of Object.entries(bindings)) {
      if (!(key in params)) params[key] = resolveBindingExpression(expr, dashboard);
    }
  }

  // Default global time range
  const time = defaultTimeParams(dashboard);
  if (!('__from' in params)) params.__from = time.__from;
  if (!('__to' in params)) params.__to = time.__to;

  // Templating variables by name (current values)
  dashboard?.templating?.list?.forEach((v) => {
    if (v.current?.value !== undefined && !(v.name in params)) {
      params[v.name] = v.current.value;
    }
  });

  return params;
}

/**
 * Locate every SQL panel a multiselect filter applies to (its recorded apply
 * set, falling back to the single source panel for older variables). Used to
 * resolve the parameter contexts of all the panels its discovery query wraps.
 */
export function findFilterPanels(variable: Variable, panels: Panel[] | undefined): Panel[] {
  const nav = variable['x-navixy'];
  if (nav?.control !== 'multiselect') return [];
  if ((nav.panelId === undefined || nav.panelId === null) && !nav.panelTitle && !(nav.panels && nav.panels.length > 0)) {
    return [];
  }

  const found: Panel[] = [];
  const visit = (list: Panel[]) => {
    for (const p of list) {
      if (p['x-navixy']?.sql?.statement && filterAppliesToPanel(variable, p)) {
        found.push(p);
      }
      if (p.panels?.length) visit(p.panels);
    }
  };
  if (panels) visit(panels);
  return found;
}

/** Double-quote a SQL identifier, escaping embedded quotes. */
export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * The SQL clause shape a filter binding produces (for editor previews). Mirrors
 * applyPanelFilters but always renders the multiselect clause regardless of the
 * current selection.
 */
export function filterClausePreview(variable: Variable, column: string): string {
  const q = quoteIdentifier(column);
  const control = variable['x-navixy']?.control;
  if (control === 'daterange') {
    const names = dateRangeParamNames(variable.name);
    return `${q} BETWEEN \${${names.from}} AND \${${names.to}}`;
  }
  if (control === 'multiselect') {
    return `${q}::text = ANY(\${${variable.name}}::text[])`;
  }
  return '';
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
  dashboard: Dashboard | null | undefined,
  values?: Record<string, unknown>
): string {
  if (!filters || filters.length === 0) return statement;

  const clauses: string[] = [];
  for (const binding of filters) {
    if (!binding.column) continue;
    const variable = dashboard?.templating?.list?.find((v) => v.name === binding.variable);
    const control = variable?.['x-navixy']?.control;
    if (control === 'daterange') {
      const names = dateRangeParamNames(binding.variable);
      clauses.push(
        `${quoteIdentifier(binding.column)} BETWEEN \${${names.from}} AND \${${names.to}}`
      );
    } else if (control === 'multiselect') {
      // Only filter when something is selected; an empty selection means "All".
      // The column is cast to text so non-text columns (ids, numerics, uuids)
      // compare cleanly against the text[] selection.
      const selection = values?.[binding.variable];
      if (Array.isArray(selection) && selection.length > 0) {
        clauses.push(`${quoteIdentifier(binding.column)}::text = ANY(\${${binding.variable}}::text[])`);
      }
    }
  }

  if (clauses.length === 0) return statement;

  const inner = statement.trim().replace(/;\s*$/, '');
  return `SELECT * FROM (\n${inner}\n) AS _navixy_filter\nWHERE ${clauses.join(' AND ')}`;
}

/**
 * Reconcile panel filter bindings after the dashboard's filter variables change.
 *
 * - Bindings to variables that no longer exist are removed, so deleting a filter
 *   cleans up every panel it touched (no stale bindings that silently reactivate
 *   when a same-named filter is created later).
 * - A multiselect filter is auto-bound to its source panel when it is created or
 *   when its column/source panel changes, and removed from panels that are no
 *   longer its source. Unchanged filters keep their bindings as-is, so a manual
 *   opt-out in the panel editor survives unrelated edits.
 * - Date-range bindings are author-managed and only pruned on deletion.
 */
export function reconcileFilterBindings(
  panels: Panel[],
  oldVariables: Variable[],
  newVariables: Variable[]
): Panel[] {
  const newNames = new Set(newVariables.map((v) => v.name));
  const oldByName = new Map(oldVariables.map((v) => [v.name, v]));

  const panelsKey = (nav: NonNullable<Variable['x-navixy']> | undefined): string =>
    JSON.stringify((nav?.panels ?? []).map((p) => `${p.id ?? ''}|${p.title ?? ''}`));

  const needsBinding = (v: Variable): boolean => {
    const nav = v['x-navixy'];
    if (nav?.control !== 'multiselect' || !nav.column) return false;
    // Without any recorded target panel there is nowhere to auto-bind.
    if ((nav.panelId === undefined || nav.panelId === null) && !nav.panelTitle && !(nav.panels && nav.panels.length > 0)) return false;
    const old = oldByName.get(v.name)?.['x-navixy'];
    if (!old || old.control !== 'multiselect') return true;
    return (
      old.column !== nav.column ||
      String(old.panelId ?? '') !== String(nav.panelId ?? '') ||
      (old.panelTitle ?? '') !== (nav.panelTitle ?? '') ||
      panelsKey(old) !== panelsKey(nav)
    );
  };
  const autoBind = newVariables.filter(needsBinding);

  const mapPanel = (panel: Panel): Panel => {
    const newChildren = panel.panels ? panel.panels.map(mapPanel) : undefined;
    const childChanged = !!newChildren && newChildren.some((c, i) => c !== panel.panels![i]);

    let filters = panel['x-navixy']?.filters ?? [];
    let changed = false;

    const pruned = filters.filter((f) => newNames.has(f.variable));
    if (pruned.length !== filters.length) {
      filters = pruned;
      changed = true;
    }

    for (const v of autoBind) {
      const nav = v['x-navixy']!;
      const existing = filters.findIndex((f) => f.variable === v.name);
      if (filterAppliesToPanel(v, panel)) {
        if (existing >= 0) {
          if (filters[existing].column !== nav.column) {
            filters = filters.map((f, i) => (i === existing ? { ...f, column: nav.column! } : f));
            changed = true;
          }
        } else {
          filters = [...filters, { variable: v.name, column: nav.column! }];
          changed = true;
        }
      } else if (existing >= 0) {
        filters = filters.filter((f) => f.variable !== v.name);
        changed = true;
      }
    }

    if (!changed && !childChanged) return panel;
    const next: Panel = { ...panel };
    if (childChanged) next.panels = newChildren;
    if (changed) next['x-navixy'] = { ...panel['x-navixy'], filters };
    return next;
  };

  return panels.map(mapPanel);
}

export interface ActivePanelFilter {
  variable: string;
  label: string;
  column: string;
}

/**
 * Resolve a panel's active local filter bindings — those whose column is set and
 * whose variable still exists as a local filter (date-range or multiselect). The
 * indicator is config-level: it shows whenever a panel is wired to a filter,
 * regardless of the current selection.
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
    const control = variable?.['x-navixy']?.control;
    if (control === 'daterange' || control === 'multiselect') {
      active.push({
        variable: binding.variable,
        label: variable.label || variable.name,
        column: binding.column,
      });
    }
  }
  return active;
}
