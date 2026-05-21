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
//       dateFormat: "dd.mm.yyyy",
//       timeFormat: "h24",
//     },
//   }

export const DATE_FORMAT_VALUES = [
  'default',
  'dd.mm.yyyy',
  'mm-dd-yyyy',
  'yyyy-mm-dd',
  'dd-mmm-yyyy',
  'dd-mmmm-yyyy',
] as const;

export const TIME_FORMAT_VALUES = ['default', 'h24'] as const;

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
    const dateFormat = isDateFormat(prefs.dateFormat) ? prefs.dateFormat : 'default';
    const timeFormat = isTimeFormat(prefs.timeFormat) ? prefs.timeFormat : 'default';
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
      dateFormat: isDateFormat(parsed.dateFormat) ? parsed.dateFormat : 'default',
      timeFormat: isTimeFormat(parsed.timeFormat) ? parsed.timeFormat : 'default',
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
    if (prefs.dateFormat && prefs.dateFormat !== 'default') {
      result.dateFormat = prefs.dateFormat;
    }
    if (prefs.timeFormat && prefs.timeFormat !== 'default') {
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