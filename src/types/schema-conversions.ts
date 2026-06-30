/**
 * Conversions across the stored-schema ⇄ Grafana `Dashboard` boundary.
 *
 * A report's `report_schema` is persisted in one of several historical shapes
 * (legacy `rows`, direct `panels`, or a nested `dashboard`) and is therefore
 * typed loosely as {@link RawReportSchema}, which carries an index signature so
 * it stays assignable from arbitrary parsed JSON. The editor and renderer work
 * with the canonical Grafana {@link Dashboard} shape.
 *
 * The two types overlap structurally, but TypeScript can't relate them because
 * of that index signature, so the only sound conversion is through `unknown`.
 * These helpers keep the unavoidable assertions in one auditable place — with
 * the rationale attached — instead of scattering `as unknown as X` across every
 * call site. They compile to identity: no runtime cost, no behavioural change.
 */
import type { Dashboard, RawReportSchema, SchemaRow } from '@/types/dashboard-types';
import type { ReportSchema } from '@/types/report-schema';

/** Narrow a probed/migrated stored schema to the canonical Dashboard shape. */
export const asDashboard = (schema: unknown): Dashboard => schema as Dashboard;

/**
 * Pick the canonical {@link Dashboard} out of a parsed schema, accepting either the
 * direct `{ panels: [...] }` shape or the nested `{ dashboard: { panels: [...] } }`
 * shape. Returns `null` when neither carries a `panels` array.
 *
 * Membership is decided purely on shape (an empty `panels` array still counts as a
 * dashboard); callers that must reject an *empty* dashboard should check
 * `panels.length` themselves.
 */
export const normalizeToDashboard = (schema: unknown): Dashboard | null => {
  const s = schema as { panels?: unknown; dashboard?: { panels?: unknown } } | null | undefined;
  if (Array.isArray(s?.panels)) {
    return asDashboard(s);
  }
  const dash = s?.dashboard;
  if (Array.isArray(dash?.panels)) {
    return asDashboard(dash);
  }
  return null;
};

/** Widen a Dashboard back to the loosely-typed stored-schema shape for persistence. */
export const asRawReportSchema = (dashboard: unknown): RawReportSchema => dashboard as RawReportSchema;

/** View a raw stored schema as the legacy {@link ReportSchema} migration input. */
export const asReportSchema = (schema: unknown): ReportSchema => schema as ReportSchema;

/** Treat a freshly-built editor row as a stored {@link SchemaRow}. */
export const asSchemaRow = (row: unknown): SchemaRow => row as SchemaRow;
