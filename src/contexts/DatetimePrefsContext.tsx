import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DatetimePrefs,
  detectDefaultPrefs,
  mergeServerPreferences,
  normalizeStoredPrefs,
  resolveEffectiveTimeZone,
  sampleEffectiveTimeZone,
} from '@/utils/datetime';
import { useAuth } from '@/contexts/AuthContext';
import type { ServerPreferences } from '@/contexts/AuthContext';
import { setSqlTimeZonePreference } from '@/services/sqlTimeZone';
import { useEffectiveTimeZone } from '@/hooks/use-effective-time-zone';

const STORAGE_KEY = 'navixy.datetimePrefs.v1';

interface DatetimePrefsContextValue {
  prefs: DatetimePrefs;
  setPrefs: (next: Partial<DatetimePrefs>) => void;
  resetPrefs: () => void;
  /**
   * The concrete zone `prefs.timeZone` resolves to right now — the one
   * value execution effects, cache keys, exports and timestamp formatting
   * must agree on (DO-352). Undefined only when Intl cannot answer.
   */
  effectiveTimeZone: string | undefined;
  /**
   * Re-sample the effective zone at a moment no listener covers (the
   * auto-refresh tick, building an export request). Returns the zone it
   * resolved and syncs `effectiveTimeZone`, so a change noticed this way
   * also re-runs everything depending on it.
   */
  resampleEffectiveTimeZone: () => string | undefined;
}

const DatetimePrefsContext = createContext<DatetimePrefsContextValue | undefined>(
  undefined,
);

function readFromStorage(): DatetimePrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Field validation (incl. the legacy bare-offset timezone migration,
    // DO-352 review round 4) lives in normalizeStoredPrefs so it is
    // unit-testable without a window; the writeToStorage effect then
    // persists the cleaned prefs on first render, completing the migration.
    return normalizeStoredPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeToStorage(prefs: DatetimePrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage might be unavailable (privacy mode); ignore.
  }
}

function applyServerPreferences(
  data: ServerPreferences,
  setPrefsState: React.Dispatch<React.SetStateAction<DatetimePrefs>>,
) {
  // Merge semantics (incl. refusing malformed or bare-offset zones from an
  // older backend / stale demo storage) live in mergeServerPreferences,
  // which returns `prev` untouched when nothing changed.
  setPrefsState((prev) => mergeServerPreferences(prev, data));
}

export function DatetimePrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<DatetimePrefs>(
    () => readFromStorage() ?? detectDefaultPrefs(),
  );

  // Keep the SQL-session zone registry in step during render, not in an
  // effect: children's data-fetching effects run before a parent's, so an
  // effect here would hand the first queries after mount — and the ones
  // re-fired when server preferences merge in — the previous zone (DO-352).
  // Writing a module variable is idempotent, so re-renders and StrictMode
  // double-renders are harmless.
  setSqlTimeZonePreference(prefs.timeZone);

  // The app's one reactive effective-zone instance (DO-352 review round 6).
  // Mounted here so its focus/visibility listeners outlive any single view,
  // and exposed through the context so execution deps, cache keys, exports
  // and formatTimestamp all follow the same observed zone — a change
  // re-renders every prefs consumer, repainting already-formatted
  // timestamps in the new zone.
  const [effectiveTimeZone, resampleEffectiveTimeZone] = useEffectiveTimeZone(
    prefs.timeZone,
  );

  useEffect(() => {
    writeToStorage(prefs);
  }, [prefs]);

  const setPrefs = useCallback((next: Partial<DatetimePrefs>) => {
    setPrefsState((prev) => ({ ...prev, ...next }));
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefsState(detectDefaultPrefs());
  }, []);

  // Merge server-side preferences delivered by the login / /auth/me
  // response. No separate API call needed — AuthContext already fetches
  // them and exposes `serverPreferences`. This is synchronous with the
  // auth state change, so there is no flash-of-defaults even when
  // localStorage is unavailable (e.g. cross-origin iframe).
  const { serverPreferences } = useAuth();

  useEffect(() => {
    if (!serverPreferences) return;
    applyServerPreferences(serverPreferences, setPrefsState);
  }, [serverPreferences]);

  const value = useMemo<DatetimePrefsContextValue>(
    () => ({
      prefs,
      setPrefs,
      resetPrefs,
      effectiveTimeZone,
      resampleEffectiveTimeZone,
    }),
    [prefs, setPrefs, resetPrefs, effectiveTimeZone, resampleEffectiveTimeZone],
  );

  return (
    <DatetimePrefsContext.Provider value={value}>
      {children}
    </DatetimePrefsContext.Provider>
  );
}

export function useDatetimePrefs(): DatetimePrefsContextValue {
  const ctx = useContext(DatetimePrefsContext);
  if (!ctx) {
    // Tolerate usage outside the provider (e.g. legacy pages, tests) by
    // returning a read-only snapshot of the detected defaults. This avoids
    // hard runtime errors during incremental rollout. Non-reactive: without
    // the provider's hook instance nothing re-samples the zone, so resolve
    // it per call and let resample() do the same.
    const fallback = detectDefaultPrefs();
    return {
      prefs: fallback,
      setPrefs: () => undefined,
      resetPrefs: () => undefined,
      effectiveTimeZone: resolveEffectiveTimeZone(fallback.timeZone),
      resampleEffectiveTimeZone: () => sampleEffectiveTimeZone(fallback.timeZone),
    };
  }
  return ctx;
}
