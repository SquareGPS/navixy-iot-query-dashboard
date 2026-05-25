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

/**
 * User-selectable date format presets. Every value is an explicit pattern
 * rendered the same way regardless of locale so the user sees exactly what
 * they picked in Settings. `'dd/mm/yyyy'` is the "neutral" pick and the
 * fallback for legacy `'default'` values still in storage.
 */
export type DateFormatPref =
  | 'dd/mm/yyyy'
  | 'dd.mm.yyyy'
  | 'mm-dd-yyyy'
  | 'yyyy-mm-dd'
  | 'dd-mmm-yyyy'
  | 'dd-mmmm-yyyy';

/**
 * User-selectable time format. `h12` renders 12-hour with AM/PM ("01:13 PM");
 * `h24` renders 24-hour ("13:13"). There is no `default` value — the dropdown
 * is seeded from {@link DatetimePrefs.hourCycle} for first-time users so the
 * initial pick matches their locale, but the stored value is always explicit.
 */
export type TimeFormatPref = 'h12' | 'h24';

export interface DatetimePrefs {
  /** BCP-47 locale tag (e.g. "en-US", "ru-RU", "en-GB"). */
  locale: string;
  /** IANA timezone name (e.g. "Europe/Berlin") or "auto" to use the host. */
  timeZone: string | 'auto';
  /** 12-hour or 24-hour clock. */
  hourCycle: HourCycle;
  /** Compactness preset for date display. */
  dateStyle: DatetimeStyle;
  /** Optional explicit date pattern; falls back to {@link dateStyle} when absent. */
  dateFormat?: DateFormatPref;
  /** Optional explicit time pattern; falls back to {@link hourCycle} when absent. */
  timeFormat?: TimeFormatPref;
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
 * Seed value for the Time format dropdown when nothing is stored yet. Reads
 * the host locale's conventional clock so users in 12-hour locales (en-US,
 * en-CA, ...) see "12-hour clock" pre-selected and users in 24-hour locales
 * see "24-hour clock" pre-selected — matching what their Data Table renders.
 */
export function detectInitialTimeFormat(): TimeFormatPref {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    return resolved.hourCycle === 'h12' || resolved.hour12 ? 'h12' : 'h24';
  } catch {
    return 'h12';
  }
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
 *
 * Both `prefs.dateFormat` and `prefs.timeFormat` are explicit patterns
 * (no more `'default'`); the result is rendered the same way regardless
 * of locale so what the user picks in Settings is what they see in
 * tables, charts, and exports.
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
  // Legacy prefs may not have either format set; seed from sensible defaults
  // so users who never opened Settings still get a stable rendering.
  const dateFmt: DateFormatPref = prefs.dateFormat ?? 'dd/mm/yyyy';
  const timeFmt: TimeFormatPref =
    prefs.timeFormat ?? (prefs.hourCycle === 'h12' ? 'h12' : 'h24');

  const datePart = formatDateWithPattern(date, dateFmt, timeZone);
  if (!includeTime) return datePart;
  const timePart = formatTimeWithPattern(date, timeFmt, prefs, timeZone);
  return `${datePart} ${timePart}`;
}

interface ZoneComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Decompose a Date into wall-clock components in `timeZone` (or the host
 * zone when undefined). Returns null on Intl failure (e.g. unknown zone).
 */
function getZoneComponents(date: Date, timeZone?: string): ZoneComponents | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const map: Record<string, string> = {};
    for (const part of fmt.formatToParts(date)) {
      if (part.type !== 'literal') map[part.type] = part.value;
    }
    // ICU sometimes returns "24" for midnight under hourCycle h23.
    const hourStr = map.hour === '24' ? '00' : map.hour;
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(hourStr),
      minute: Number(map.minute),
      second: Number(map.second),
    };
  } catch {
    return null;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateWithPattern(
  date: Date,
  fmt: DateFormatPref,
  timeZone?: string,
): string {
  const c = getZoneComponents(date, timeZone);
  if (!c) return date.toISOString();
  const dd = pad2(c.day);
  const mm = pad2(c.month);
  const yyyy = String(c.year);
  switch (fmt) {
    case 'dd.mm.yyyy':
      return `${dd}.${mm}.${yyyy}`;
    case 'mm-dd-yyyy':
      return `${mm}-${dd}-${yyyy}`;
    case 'yyyy-mm-dd':
      return `${yyyy}-${mm}-${dd}`;
    case 'dd-mmm-yyyy':
      return `${c.day} ${MONTHS_SHORT[c.month - 1]} ${yyyy}`;
    case 'dd-mmmm-yyyy':
      return `${c.day} ${MONTHS_LONG[c.month - 1]} ${yyyy}`;
    case 'dd/mm/yyyy':
    default:
      return `${dd}/${mm}/${yyyy}`;
  }
}

function formatTimeWithPattern(
  date: Date,
  fmt: TimeFormatPref,
  prefs: DatetimePrefs,
  timeZone?: string,
): string {
  const hour12 = fmt === 'h12';
  // Prefer Intl so AM/PM follows locale conventions ("PM" vs "п.п." vs "下午"
  // depending on locale); fall back to a manual render if Intl rejects the
  // zone or locale.
  try {
    return new Intl.DateTimeFormat(prefs.locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    }).format(date);
  } catch {
    const c = getZoneComponents(date, timeZone);
    if (!c) return '';
    if (!hour12) return `${pad2(c.hour)}:${pad2(c.minute)}`;
    const period = c.hour >= 12 ? 'PM' : 'AM';
    const h12 = c.hour % 12 === 0 ? 12 : c.hour % 12;
    return `${pad2(h12)}:${pad2(c.minute)} ${period}`;
  }
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
