import type { Pool } from 'pg';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

// The preference value (currently just `timezone`) lives inside the existing
// `raw_user_meta_data` JSONB column on the users table under the
// `preferences` sub-key. Shape on disk:
//   raw_user_meta_data = { iotDbUrl: "...", ..., preferences: { timezone: "Europe/Belgrade" } }

export interface UserPreferences {
  timezone: string;
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
    return { timezone };
  } finally {
    client.release();
  }
}

/**
 * Merge `{ preferences: { timezone } }` into raw_user_meta_data without
 * touching siblings. A single `jsonb_set('{preferences,timezone}', ...)`
 * doesn't work here because that function only creates the leaf key, not
 * intermediate keys — when `preferences` doesn't yet exist on the user,
 * jsonb_set silently leaves the row untouched. The `||` merge below handles
 * all cases (missing column, missing key, key exists).
 *
 * Returns the saved timezone, or `null` when the user row is not found.
 * The caller is responsible for validating the timezone identifier before
 * calling this — no Intl check happens here.
 */
export async function writeUserTimezone(
  settingsPool: Pool,
  userId: string,
  timezone: string,
): Promise<string | null> {
  const client = await settingsPool.connect();
  try {
    const result = await client.query(
      `UPDATE dashboard_studio_meta_data.users
       SET raw_user_meta_data =
         COALESCE(raw_user_meta_data, '{}'::jsonb)
         || jsonb_build_object(
              'preferences',
              COALESCE(raw_user_meta_data->'preferences', '{}'::jsonb)
              || jsonb_build_object('timezone', $1::text)
            )
       WHERE id = $2
       RETURNING raw_user_meta_data->'preferences'->>'timezone' AS timezone`,
      [timezone, userId],
    );
    return result.rows[0]?.timezone ?? null;
  } finally {
    client.release();
  }
}

/**
 * Safe wrapper used by export paths: reads the user's stored timezone,
 * validates the identifier against ICU, and swallows every failure
 * (missing pool/user, DB error, invalid identifier). Returns `undefined`
 * so callers can gracefully fall back to server-local formatting.
 */
export async function getUserTimezoneForExport(
  req: AuthenticatedRequest,
): Promise<string | undefined> {
  const settingsPool = req.settingsPool;
  const userId = req.user?.userId;
  if (!settingsPool || !userId) return undefined;

  try {
    const { timezone } = await readUserPreferences(settingsPool, userId);
    const tz = timezone.trim();
    if (!tz) return undefined;
    try {
      new Intl.DateTimeFormat('en', { timeZone: tz });
    } catch {
      logger.warn('Ignoring invalid user timezone preference', { userId, timezone: tz });
      return undefined;
    }
    return tz;
  } catch (err) {
    logger.error('Failed to read user timezone preference', {
      userId,
      err: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}