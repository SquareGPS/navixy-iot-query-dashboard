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
 * Compute the offset (in minutes) of the given UTC instant as observed
 * in `timeZone`. Positive numbers mean the zone is ahead of UTC.
 *
 * Implemented by reconstructing the wall-clock representation of `date`
 * in the target zone via Intl.DateTimeFormat, then comparing against
 * the input as if it were UTC.
 */
function getZoneOffsetMinutes(date: Date, timeZone: string): number {
  // `Intl.DateTimeFormat.formatToParts` returns only second precision —
  // there is no `fractionalSecondDigits` option that yields a usable
  // value here. Align the input to whole seconds before computing the
  // delta so callers that iterate the offset (for DST boundary
  // refinement) don't accumulate sub-second drift.
  const aligned = new Date(date.getTime() - date.getMilliseconds());
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const lookup: Record<string, string> = {};
  for (const part of fmt.formatToParts(aligned)) lookup[part.type] = part.value;
  const wallClockAsUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(lookup.hour) === 24 ? 0 : Number(lookup.hour),
    Number(lookup.minute),
    Number(lookup.second),
  );
  return (wallClockAsUtc - aligned.getTime()) / 60_000;
}

const NAIVE_TS_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

/**
 * Convert a naive local wall-clock string (e.g. "2026-05-12T05:00") to
 * a UTC ISO-8601 string, interpreting the wall-clock as belonging to
 * the given IANA timezone (e.g. "Asia/Tokyo").
 *
 * When `timeZone` is falsy or "auto", the input is interpreted in the
 * system timezone via the regular `Date` constructor (legacy behaviour).
 */
export function toUtcIsoInZone(naive: string, timeZone?: string): string {
  if (typeof naive !== 'string' || naive.length === 0) return '';
  const trimmed = naive.trim();
  if (!timeZone || timeZone === 'auto') {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
  const m = NAIVE_TS_RE.exec(trimmed);
  if (!m) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? '' : fallback.toISOString();
  }
  const [, y, mo, d, h, mi, s, ms] = m;
  const asIfUtcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
    ms ? Number((ms + '000').slice(0, 3)) : 0,
  );
  // First-pass offset assumes the naive moment is already the wall
  // clock for the zone; refine once because DST boundaries can move
  // the actual offset by up to an hour.
  const offset1 = getZoneOffsetMinutes(new Date(asIfUtcMs), timeZone);
  const offset2 = getZoneOffsetMinutes(new Date(asIfUtcMs - offset1 * 60_000), timeZone);
  return new Date(asIfUtcMs - offset2 * 60_000).toISOString();
}

/**
 * Format a Date as a "YYYY-MM-DDTHH:mm" string showing the wall-clock
 * in `timeZone`, suitable for the `value` of <input type="datetime-local">.
 *
 * When `timeZone` is falsy or "auto", falls back to the host's local
 * wall-clock (i.e. the browser's reported zone).
 */
export function formatLocalInputInZone(date: Date, timeZone?: string): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  if (!timeZone || timeZone === 'auto') {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const lookup: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) lookup[part.type] = part.value;
  const hour = lookup.hour === '24' ? '00' : lookup.hour;
  return `${lookup.year}-${lookup.month}-${lookup.day}T${hour}:${lookup.minute}`;
}

/**
 * Sanitise an arbitrary parameter value before sending to the API.
 *
 * - If the value looks like a date AND the parameter name is date-like,
 *   convert it to a UTC ISO string.
 * - Otherwise return the value unchanged.
 *
 * `options.timeZone` controls how naive wall-clock strings (no TZ
 * suffix, e.g. from a datetime-local input) are interpreted before
 * being converted to UTC. When omitted, the system timezone is used.
 */
export function normaliseParamForApi(
  name: string,
  value: unknown,
  options: { timeZone?: string } = {},
): unknown {
  if (value == null) return value;
  if (!isDateLikeParam(name)) return value;

  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    if (value.trim() === '') return value;
    if (TIMEZONE_SUFFIX_RE.test(value)) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? value : d.toISOString();
    }
    const converted = toUtcIsoInZone(value, options.timeZone);
    return converted || value;
  }
  return value;
}
