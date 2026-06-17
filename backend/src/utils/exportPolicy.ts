/**
 * Shared export policy helpers.
 *
 * Centralizes the SQL-timeout and row-cap rules used by both the dashboard-panel
 * export (routes/panels.ts) and the composite-report export
 * (routes/composite-reports.ts) paths, so the policy lives in one place instead
 * of being re-derived per route.
 */

/** Default interactive query timeout when no global override is set. */
const DEFAULT_TIMEOUT_MS = 30000;

/** Minimum statement timeout granted to exports (they run longer than interactive queries). */
const EXPORT_MIN_TIMEOUT_MS = 60000;

/**
 * Resolve the base SQL statement timeout from global variables.
 * Falls back to `defaultTimeout` (30s) when `sql_timeout_ms` is unset/invalid.
 */
export function getTimeoutFromGlobalVars(
  globalVars: Record<string, string>,
  defaultTimeout: number = DEFAULT_TIMEOUT_MS,
): number {
  const raw = globalVars.sql_timeout_ms;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultTimeout;
}

/**
 * Resolve the SQL statement timeout for exports: the interactive base timeout,
 * doubled and floored at 60s — exports legitimately run longer than interactive
 * queries (larger row caps, no client-side pagination).
 */
export function resolveExportTimeoutMs(globalVars: Record<string, string>): number {
  return Math.max(getTimeoutFromGlobalVars(globalVars) * 2, EXPORT_MIN_TIMEOUT_MS);
}

/**
 * Row caps for the dashboard-panel export path (routes/panels.ts).
 *
 * Exports re-run the panel query server-side, so they are allowed far more rows
 * than the live panel view (which caps table panels at 10k for client-side
 * pagination). The table ceiling matches the composite-report export; the hard
 * cap is a safety bound against an accidental or abusive request.
 */
export const EXPORT_TABLE_MAX_ROWS = 100000;
export const EXPORT_OTHER_MAX_ROWS = 1000;
export const EXPORT_HARD_CAP = 1000000;

/**
 * Decide the export row cap for a dashboard panel, server-side.
 *
 * Table panels get the high ceiling (100k) so a full table can be exported
 * beyond the live-view cap; other panel types keep a small default so e.g. a
 * chart's CSV doesn't balloon. A per-panel `verify.max_rows` override can only
 * raise the table ceiling, never lower it. Everything is clamped to
 * EXPORT_HARD_CAP.
 *
 * `configuredMaxRows` is the panel's raw `x-navixy.verify.max_rows` (if any);
 * the *policy* (the per-type ceiling) is owned here, not by the client.
 */
export function resolvePanelExportMaxRows(
  panelType: string | undefined,
  configuredMaxRows?: number,
): number {
  const configured =
    typeof configuredMaxRows === 'number' && Number.isFinite(configuredMaxRows) && configuredMaxRows > 0
      ? Math.floor(configuredMaxRows)
      : undefined;
  const cap =
    panelType === 'table'
      ? Math.max(configured ?? 0, EXPORT_TABLE_MAX_ROWS)
      : (configured ?? EXPORT_OTHER_MAX_ROWS);
  return Math.min(cap, EXPORT_HARD_CAP);
}
