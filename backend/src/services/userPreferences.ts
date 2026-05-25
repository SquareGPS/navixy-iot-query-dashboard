import type { Pool } from 'pg';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

// The preference values live inside the existing `raw_user_meta_data` JSONB
// column on the users table under the `preferences` sub-key. Shape on disk:
//   raw_user_meta_data = {
//     iotDbUrl: "...",
//     ...,
//     preferences: {
//       timezone: "Europe/Belgrade",
//       dateFormat: "dd/mm/yyyy",
//       timeFormat: "h12",
//     },
//   }

// 'dd/mm/yyyy' replaces the legacy 'default' value. The old default rendered
// `dd/mm/yy` (2-digit year) in exports despite the Settings dropdown labelling
// it as "01/12/2021 (DD/MM/YYYY)" — see export.ts for the previous behaviour.
// Any stored 'default' is mapped to 'dd/mm/yyyy' on read so users get what the
// label promised.
export const DATE_FORMAT_VALUES = [
  'dd/mm/yyyy',
  'dd.mm.yyyy',
  'mm-dd-yyyy',
  'yyyy-mm-dd',
  'dd-mmm-yyyy',
  'dd-mmmm-yyyy',
] as const;

// 'h12' renders 12-hour with AM/PM ("01:13 PM"), 'h24' renders 24-hour ("13:13").
// The legacy 'default' value used to mean "follow locale", but the backend has
// no locale and the resulting export was indistinguishable from 'h24' (dead
// branch); we now reject 'default' and map any stored value to 'h12' so users
// who picked the old "12:13 PM (12-hour clock) — Default" option get what the
// dropdown promised.
export const TIME_FORMAT_VALUES = ['h12', 'h24'] as const;

export type DateFormat = (typeof DATE_FORMAT_VALUES)[number];
export type TimeFormat = (typeof TIME_FORMAT_VALUES)[number];

export interface UserPreferences {
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
}

function isDateFormat(value: unknown): value is DateFormat {
  return (
    typeof value === 'string' &&
    (DATE_FORMAT_VALUES as readonly string[]).includes(value)
  );
}

function isTimeFormat(value: unknown): value is TimeFormat {
  return (
    typeof value === 'string' &&
    (TIME_FORMAT_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Read the stored preferences for a user. Returns `{ timezone: '' }` when no
 * preferences row exists or `timezone` is unset. Throws on DB errors; the
 * caller decides whether to surface them.
 */
export async function readUserPreferences(
  settingsPool: Pool,
  userId: string,
): Promise<UserPreferences> {
  const client = await settingsPool.connect();
  try {
    const result = await client.query(
      'SELECT raw_user_meta_data FROM dashboard_studio_meta_data.users WHERE id = $1',
      [userId],
    );
    const raw = result.rows[0]?.raw_user_meta_data;
    const metaData = (typeof raw === 'string' ? JSON.parse(raw) : raw) ?? {};
    const prefs =
      (metaData && typeof metaData === 'object' && metaData.preferences) || {};
    const timezone = typeof prefs.timezone === 'string' ? prefs.timezone : '';
    // Legacy 'default' and missing fields map to 'dd/mm/yyyy' (matches the
    // prior dropdown label "01/12/2021 (DD/MM/YYYY) — Default").
    const dateFormat = isDateFormat(prefs.dateFormat) ? prefs.dateFormat : 'dd/mm/yyyy';
    // Legacy values (e.g. the old 'default') and missing fields map to 'h12'
    // — matches the prior dropdown label "12:13 PM (12-hour clock) — Default".
    const timeFormat = isTimeFormat(prefs.timeFormat) ? prefs.timeFormat : 'h12';
    return { timezone, dateFormat, timeFormat };
  } finally {
    client.release();
  }
}

/**
 * Merge a partial preferences patch into raw_user_meta_data without touching
 * siblings. A single `jsonb_set('{preferences,...}', ...)` doesn't work here
 * because that function only creates the leaf key, not intermediate keys —
 * when `preferences` doesn't yet exist on the user, jsonb_set silently leaves
 * the row untouched. The `||` merge below handles all cases (missing column,
 * missing key, key exists).
 *
 * Returns the full saved preferences object, or `null` when the user row is
 * not found. The caller is responsible for validating each field before
 * calling this — no Intl/whitelist checks happen here.
 */
export async function writeUserPreferences(
  settingsPool: Pool,
  userId: string,
  patch: Partial<UserPreferences>,
): Promise<UserPreferences | null> {
  const client = await settingsPool.connect();
  try {
    const result = await client.query(
      `UPDATE dashboard_studio_meta_data.users
       SET raw_user_meta_data =
         COALESCE(raw_user_meta_data, '{}'::jsonb)
         || jsonb_build_object(
              'preferences',
              COALESCE(raw_user_meta_data->'preferences', '{}'::jsonb) || $1::jsonb
            )
       WHERE id = $2
       RETURNING raw_user_meta_data->'preferences' AS preferences`,
      [JSON.stringify(patch), userId],
    );
    const stored = result.rows[0]?.preferences;
    if (stored == null) return null;
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return {
      timezone: typeof parsed.timezone === 'string' ? parsed.timezone : '',
      // See readUserPreferences: legacy 'default' / missing → 'dd/mm/yyyy'.
      dateFormat: isDateFormat(parsed.dateFormat) ? parsed.dateFormat : 'dd/mm/yyyy',
      // See readUserPreferences: legacy 'default' / missing → 'h12'.
      timeFormat: isTimeFormat(parsed.timeFormat) ? parsed.timeFormat : 'h12',
    };
  } finally {
    client.release();
  }
}

/**
 * Resolved subset of preferences used by export routes. Any/all fields may
 * be undefined when the user hasn't set them (or when reading fails) — the
 * export service falls back to its existing defaults in that case.
 */
export interface ExportPreferences {
  timeZone?: string;
  dateFormat?: DateFormat;
  timeFormat?: TimeFormat;
}

/**
 * Validate a request-body patch and merge it with the user's stored prefs.
 * Body values win when present and valid; a body-supplied `'default'` format
 * falls through to the stored pref so an explicit default in the request
 * doesn't shadow a non-default DB pref.
 *
 * Routes prefer this over {@link getUserExportPreferences} so the active
 * session's resolved timezone reaches the export service even when the
 * stored preferences row is empty (demo mode, or the user never clicked
 * "Save Preferences") — without this, Excel cells fall back to UTC since
 * ExcelJS serializes Date via `getTime() / 86400000`.
 */
export async function resolveExportPreferences(
  req: AuthenticatedRequest,
  body?: { timeZone?: unknown; dateFormat?: unknown; timeFormat?: unknown },
): Promise<ExportPreferences> {
  let bodyTimeZone: string | undefined;
  if (typeof body?.timeZone === 'string' && body.timeZone.trim()) {
    const tz = body.timeZone.trim();
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
      bodyTimeZone = tz;
    } catch {
      // Ignore invalid IANA names; stored prefs may still supply one.
    }
  }
  const bodyDateFormat: DateFormat | undefined =
    typeof body?.dateFormat === 'string' &&
    (DATE_FORMAT_VALUES as readonly string[]).includes(body.dateFormat)
      ? (body.dateFormat as DateFormat)
      : undefined;
  const bodyTimeFormat: TimeFormat | undefined =
    typeof body?.timeFormat === 'string' &&
    (TIME_FORMAT_VALUES as readonly string[]).includes(body.timeFormat)
      ? (body.timeFormat as TimeFormat)
      : undefined;

  const stored = await getUserExportPreferences(req);
  const out: ExportPreferences = {};
  const tz = bodyTimeZone ?? stored.timeZone;
  if (tz) out.timeZone = tz;
  // Neither dateFormat nor timeFormat has a 'default' value any more — all
  // listed values carry concrete meaning, so the body always wins when
  // present and valid.
  const df = bodyDateFormat ?? stored.dateFormat;
  if (df) out.dateFormat = df;
  const tf = bodyTimeFormat ?? stored.timeFormat;
  if (tf) out.timeFormat = tf;
  return out;
}

/**
 * Safe wrapper that returns all export-relevant preferences in one call.
 * Every failure is swallowed so exports never fail on a settings-DB hiccup.
 */
export async function getUserExportPreferences(
  req: AuthenticatedRequest,
): Promise<ExportPreferences> {
  const settingsPool = req.settingsPool;
  const userId = req.user?.userId;
  if (!settingsPool || !userId) return {};

  try {
    const prefs = await readUserPreferences(settingsPool, userId);
    const result: ExportPreferences = {};

    const tz = prefs.timezone.trim();
    if (tz) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        result.timeZone = tz;
      } catch {
        logger.warn('Ignoring invalid user timezone preference', { userId, timezone: tz });
      }
    }
    // dateFormat and timeFormat are always one of the explicit values now —
    // pass through unconditionally.
    if (prefs.dateFormat) {
      result.dateFormat = prefs.dateFormat;
    }
    if (prefs.timeFormat) {
      result.timeFormat = prefs.timeFormat;
    }
    return result;
  } catch (err) {
    logger.error('Failed to read user export preferences', {
      userId,
      err: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}