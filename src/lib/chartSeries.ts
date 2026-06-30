/**
 * Shared series-shape detection for chart panels (DO-273).
 *
 * Query results arrive in one of two shapes:
 *   • Long format  [x, value, series]       -> one series per distinct col-3 value
 *   • Wide format  [x, value1, value2, ...]  -> one series per value column
 *
 * Bar and line/time-series panels both call detectSeriesColumnIndex so the same
 * query groups identically everywhere, instead of each panel re-deriving (and
 * drifting on) its own heuristic.
 */

/**
 * Fraction of distinct col-3 values below which the column is treated as a
 * grouping key rather than per-row identifiers. Shared by every panel so tuning
 * it can't silently change one chart type and not another.
 */
export const LONG_FORMAT_REPETITION_THRESHOLD = 0.8;

/** Index of the series-label column in long format ([x, value, series]). */
export const SERIES_COLUMN_INDEX = 2;

// Numeric column types, matched exactly (lower-cased). An exact set avoids
// substring false positives such as "interval" or "point" (both contain "int")
// being mistaken for numbers.
const NUMERIC_COLUMN_TYPES = new Set([
  'number', 'integer', 'int', 'int2', 'int4', 'int8', 'smallint', 'bigint',
  'numeric', 'decimal', 'real', 'double precision', 'float', 'float4', 'float8',
  'money', 'serial', 'bigserial', 'smallserial',
]);

interface ColumnMeta {
  name?: string;
  type?: string;
}

/**
 * Decide whether the result describes long format with a series-grouping column
 * at index 2. Returns SERIES_COLUMN_INDEX when it does, otherwise null (wide or
 * simple two-column data).
 *
 * A numeric 3rd column is treated as a grouping key only when the x-axis (col 1)
 * repeats — i.e. each series contributes a row per x. Without repeated x it is a
 * second metric (wide format), so numeric metrics aren't mistaken for groupings.
 */
export function detectSeriesColumnIndex(
  columns: ReadonlyArray<ColumnMeta>,
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): number | null {
  if (columns.length <= SERIES_COLUMN_INDEX || rows.length === 0) {
    return null;
  }

  const seriesType = String(columns[SERIES_COLUMN_INDEX]?.type || '').toLowerCase();
  const isNumericSeries = NUMERIC_COLUMN_TYPES.has(seriesType);

  // Single pass over rows: distinct series values and distinct x values.
  const distinctSeries = new Set<string>();
  const distinctX = new Set<string>();
  for (const row of rows) {
    distinctSeries.add(String(row[SERIES_COLUMN_INDEX]));
    distinctX.add(String(row[0]));
  }

  const seriesRepeats = distinctSeries.size < rows.length * LONG_FORMAT_REPETITION_THRESHOLD;
  const xHasDuplicates = distinctX.size < rows.length;

  return seriesRepeats && (!isNumericSeries || xHasDuplicates) ? SERIES_COLUMN_INDEX : null;
}

/**
 * Build a Recharts `dataKey` for a series whose key is a runtime value (a series
 * label) or a column name. Recharts resolves string dataKeys with lodash `get`,
 * so a name containing "." or "[]" (e.g. a firmware label "2.1.0") would be read
 * as a nested path and render nothing. Use a function accessor only for such
 * names; plain strings keep Recharts' per-cell memoization for the common case.
 */
export function seriesDataKey(
  name: string,
): string | ((row: Record<string, unknown>) => unknown) {
  return /[.[\]]/.test(name) ? (row) => row[name] : name;
}
