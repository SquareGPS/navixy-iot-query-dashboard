import { useCallback, useEffect, useState } from 'react';
import { resolveEffectiveTimeZone } from '@/utils/datetime';

/**
 * The viewer's effective timezone as reactive state: the stored preference
 * when it names a zone, the host's IANA zone for `'auto'` (or a value the
 * sanitizer refuses).
 *
 * `resolveEffectiveTimeZone` alone is not enough for a value that drives
 * effects and cache keys: under the `'auto'` preference the host zone lives
 * outside React, so a memo on the preference would stay pinned to the old
 * sample after an OS timezone change while per-request resolution
 * (`resolveSqlTimeZone`) and `formatTimestamp`'s keyed formatters move to
 * the new zone — queries, cache keys and exports would disagree about "the"
 * zone (DO-352 review round 5).
 *
 * No browser fires a standard event when the OS zone changes, so the hook
 * re-samples at the moments a change becomes observable:
 * - window `focus` / document `visibilitychange` — changing the OS setting
 *   means leaving the page, and waking a travelled laptop fires both;
 * - `timezonechange` — the proposed Page Lifecycle event, shipped behind a
 *   flag in some Chromium builds; a harmless no-op everywhere else;
 * - `resample()` — for refresh paths that involve no interaction (the
 *   auto-refresh interval) and for reads that must be freshest (building an
 *   export request). It returns the zone it resolved and syncs the state,
 *   so a change noticed this way also re-runs whatever depends on the value.
 *
 * Re-setting an unchanged zone is a React no-op, so in the common case the
 * listeners cost one string comparison.
 */
export function useEffectiveTimeZone(
  timeZonePreference: string | undefined,
): [string | undefined, () => string | undefined] {
  const [zone, setZone] = useState(() =>
    resolveEffectiveTimeZone(timeZonePreference),
  );

  const resample = useCallback(() => {
    const next = resolveEffectiveTimeZone(timeZonePreference);
    setZone(next);
    return next;
  }, [timeZonePreference]);

  useEffect(() => {
    // Covers the preference changing after mount and (vanishingly rare) a
    // host-zone move between the initial render and this effect. Sampling
    // is always safe, so visibilitychange is not filtered to "visible".
    resample();
    window.addEventListener('focus', resample);
    document.addEventListener('visibilitychange', resample);
    window.addEventListener('timezonechange', resample);
    return () => {
      window.removeEventListener('focus', resample);
      document.removeEventListener('visibilitychange', resample);
      window.removeEventListener('timezonechange', resample);
    };
  }, [resample]);

  return [zone, resample];
}
