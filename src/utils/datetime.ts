/**
 * Datetime utilities for the "store UTC, display local" convention.
 *
 * The backend (Postgres) stores and returns timestamps in UTC. The frontend
 * must:
 *   1. Convert local user input to UTC ISO before sending to the API.
 *   2. Parse server-returned timestamps as UTC, even when they arrive as
 *      naive strings without a `Z` / `+00` suffix.
 *   3. Format every displayed timestamp through {@link formatTimestamp} so
 *      the user's locale / timezone / hour-cycle preferences apply
 *      consistently across tables, charts, headers and exports.
 *
 * Related to FR-11265 (date/timezone consistency).
 */

// snake_case + plain names (`date_from`, `created_at`, `from`, `until`).
const DATE_LIKE_PARAM_SNAKE_RE =
  /^(__)?(date|from|to|since|until)(_|$)|(_at|_time|_date|_from|_to)$/i;

// camelCase suffix: requires a lowercase letter before the capitalised
// keyword (`dateFrom`, `createdAt`). Without that lookbehind we'd misfire
// on plain words like "photo" or "tomato" that happen to end with "to".
const DATE_LIKE_PARAM_CAMEL_RE = /[a-z](Date|From|To|At|Time|Since|Until)$/;

const TIMESTAMP_LIKE_RE =
  /^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const TIMEZONE_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/;

export type DatetimeStyle = 'short' | 'medium' | 'long';
export type HourCycle = 'h12' | 'h23';

export interface DatetimePrefs {
  /** BCP-47 locale tag (e.g. "en-US", "ru-RU", "en-GB"). */
  locale: string;
  /** IANA timezone name (e.g. "Europe/Berlin") or "auto" to use the host. */
  timeZone: string | 'auto';
  /** 12-hour or 24-hour clock. */
  hourCycle: HourCycle;
  /** Compactness preset for date display. */
  dateStyle: DatetimeStyle;
}

/**
 * Build a default preferences object from the host environment.
 * Used as a fallback when nothing is stored yet.
 */
export function detectDefaultPrefs(): DatetimePrefs {
  const resolved =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions() : null;
  return {
    locale: resolved?.locale ?? 'en-US',
    timeZone: 'auto',
    hourCycle: resolved?.hourCycle === 'h12' || resolved?.hour12 ? 'h12' : 'h23',
    dateStyle: 'short',
  };
}

/**
 * Heuristic: does a SQL parameter name look like a date/datetime?
 * Matches: date_from, dateTo, __from, __to, since, until, created_at,
 * start_time, my_date, period_from, period_to.
 */
export function isDateLikeParam(name: string): boolean {
  return (
    DATE_LIKE_PARAM_SNAKE_RE.test(name) || DATE_LIKE_PARAM_CAMEL_RE.test(name)
  );
}

/**
 * Convert a Date or a datetime-local input string (e.g. "2026-05-12T05:00")
 * into a UTC ISO-8601 string (e.g. "2026-05-12T03:00:00.000Z").
 *
 * The input is interpreted as the user's **local** wall-clock time.
 */
export function toUtcIso(input: Date | string): string {
  if (input instanceof Date) {
    return input.toISOString();
  }
  if (typeof input !== 'string' || input.length === 0) {
    return '';
  }
  if (TIMEZONE_SUFFIX_RE.test(input)) {
    return new Date(input).toISOString();
  }
  return new Date(input).toISOString();
}

/**
 * Parse a server-returned timestamp into a Date object.
 *
 * Backend convention: timestamps without an explicit timezone suffix are
 * UTC. We append `Z` before parsing so different JS engines agree on the
 * interpretation (Safari historically parsed naive strings as local).
 */
export function parseServerTimestamp(raw: string): Date | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const trimmed = raw.trim();
  if (!TIMESTAMP_LIKE_RE.test(trimmed)) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const normalised = TIMEZONE_SUFFIX_RE.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : `${trimmed.replace(' ', 'T')}Z`;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * True for values that look like an ISO date / timestamp string and should
 * be formatted through {@link formatTimestamp}. Numbers, booleans and
 * arbitrary strings (vehicle labels, status codes) return false.
 */
export function isTimestampLike(value: unknown): value is string {
  return typeof value === 'string' && TIMESTAMP_LIKE_RE.test(value.trim());
}

/**
 * Format a timestamp for display using the user's preferences.
 *
 * Accepts either a Date or a server string (which will be parsed via
 * {@link parseServerTimestamp}). Returns an empty string for invalid input
 * so callers can use it inside JSX without extra guards.
 */
export function formatTimestamp(
  value: Date | string | null | undefined,
  prefs: DatetimePrefs,
  options: { includeTime?: boolean } = {},
): string {
  if (value == null) return '';
  const date = value instanceof Date ? value : parseServerTimestamp(value);
  if (!date || Number.isNaN(date.getTime())) return '';

  const includeTime = options.includeTime ?? true;
  const timeZone = prefs.timeZone === 'auto' ? undefined : prefs.timeZone;
  const hour12 = prefs.hourCycle === 'h12';

  const formatterOptions: Intl.DateTimeFormatOptions = {
    timeZone,
    hour12,
    ...dateStyleOptions(prefs.dateStyle),
    ...(includeTime ? timeStyleOptions(prefs.dateStyle, hour12) : {}),
  };

  try {
    return new Intl.DateTimeFormat(prefs.locale, formatterOptions).format(date);
  } catch {
    return date.toISOString();
  }
}

function dateStyleOptions(style: DatetimeStyle): Intl.DateTimeFormatOptions {
  switch (style) {
    case 'long':
      return { day: 'numeric', month: 'long', year: 'numeric' };
    case 'medium':
      return { day: '2-digit', month: 'short', year: 'numeric' };
    case 'short':
    default:
      return { day: '2-digit', month: '2-digit', year: 'numeric' };
  }
}

function timeStyleOptions(
  style: DatetimeStyle,
  hour12: boolean,
): Intl.DateTimeFormatOptions {
  return {
    hour: '2-digit',
    minute: '2-digit',
    ...(style === 'long' ? { second: '2-digit' } : {}),
    hour12,
  };
}

/**
 * Sanitise an arbitrary parameter value before sending to the API.
 *
 * - If the value looks like a date AND the parameter name is date-like,
 *   convert it to a UTC ISO string.
 * - Otherwise return the value unchanged.
 *
 * Used by report execution flows that send `params` to the backend.
 */
export function normaliseParamForApi(name: string, value: unknown): unknown {
  if (value == null) return value;
  if (!isDateLikeParam(name)) return value;

  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    if (value.trim() === '') return value;
    if (TIMEZONE_SUFFIX_RE.test(value)) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? value : d.toISOString();
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return value;
}
