/**
 * Date/timestamp helpers for the export pipeline.
 *
 * These mirror the frontend's `src/utils/datetime.ts` (`isTimestampLike`,
 * `parseServerTimestamp`) so exports format date-like values exactly the way
 * the Data Table renders them on screen — see FR-11265. Kept as a small, pure
 * module (no imports) so the regex/parsing logic is unit-testable in isolation,
 * without pulling in ExcelJS/puppeteer via the export service.
 */

// Matches ISO-ish timestamps: "2026-05-20", "2026-05-20 01:02:25",
// "2026-05-20T01:02:25Z", "2026-05-20T01:02:25.123+02:00", etc.
// Mirrors the frontend's `isTimestampLike` regex.
export const TIMESTAMP_LIKE_RE =
  /^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

export const TIMEZONE_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/;

/**
 * True for values that look like an ISO date/timestamp string. Non-strings
 * (numbers, Dates, objects, null) return false.
 */
export function isTimestampLikeValue(value: unknown): value is string {
  return typeof value === 'string' && TIMESTAMP_LIKE_RE.test(value.trim());
}

/**
 * Parse a timestamp string to a Date, mirroring the frontend's
 * `parseServerTimestamp`. ISO-shaped strings without a TZ suffix are treated as
 * UTC (we append `Z`); strings that don't match the ISO shape fall back to the
 * engine's `Date` parser so non-ISO formats are handled the same way the Data
 * Table does on screen.
 */
export function parseTimestampValue(raw: string): Date | null {
  if (raw.length === 0) return null;
  const trimmed = raw.trim();
  if (!TIMESTAMP_LIKE_RE.test(trimmed)) {
    const fallback = new Date(trimmed);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  const normalised = TIMEZONE_SUFFIX_RE.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : `${trimmed.replace(' ', 'T')}Z`;
  const d = new Date(normalised);
  return isNaN(d.getTime()) ? null : d;
}