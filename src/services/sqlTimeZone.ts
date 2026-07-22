import { resolveEffectiveTimeZone } from '@/utils/datetime';

/**
 * The timezone SQL queries run in (DO-352).
 *
 * Dashboard SQL renders and windows times inside the database (`to_char`,
 * `DATE_TRUNC('day', NOW())`, `CURRENT_DATE`), so the backend sets the
 * viewer's zone on the query session. The API client has to know that zone,
 * but it is not a React consumer — and it cannot read the persisted prefs
 * itself because localStorage may be unavailable in the cross-origin iframe,
 * where the zone arrives via server preferences instead. So the
 * DatetimePrefs provider pushes the current preference here, and
 * {@link resolveSqlTimeZone} turns it into a concrete IANA name per request.
 */
let timeZonePreference: string | undefined;

/**
 * Record the user's timezone preference (`'auto'` or an IANA name). Called by
 * the DatetimePrefs provider on mount and whenever the preference changes.
 */
export function setSqlTimeZonePreference(timeZone: string | undefined): void {
  timeZonePreference = timeZone;
}

/**
 * The concrete IANA zone to send with SQL execution requests: the pushed
 * preference when explicit, the host zone for `'auto'` / before the provider
 * has mounted. Undefined only when Intl cannot answer — the backend then
 * keeps the session default, which is the pre-DO-352 behaviour.
 */
export function resolveSqlTimeZone(): string | undefined {
  return resolveEffectiveTimeZone(timeZonePreference);
}
