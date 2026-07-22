import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DatetimePrefs,
  detectDefaultPrefs,
  mergeServerPreferences,
  normalizeStoredPrefs,
} from '@/utils/datetime';
import { useAuth } from '@/contexts/AuthContext';
import type { ServerPreferences } from '@/contexts/AuthContext';
import { setSqlTimeZonePreference } from '@/services/sqlTimeZone';

const STORAGE_KEY = 'navixy.datetimePrefs.v1';

interface DatetimePrefsContextValue {
  prefs: DatetimePrefs;
  setPrefs: (next: Partial<DatetimePrefs>) => void;
  resetPrefs: () => void;
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
    () => ({ prefs, setPrefs, resetPrefs }),
    [prefs, setPrefs, resetPrefs],
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
    // returning a stable read-only snapshot of the detected defaults. This
    // avoids hard runtime errors during incremental rollout.
    const fallback = detectDefaultPrefs();
    return {
      prefs: fallback,
      setPrefs: () => undefined,
      resetPrefs: () => undefined,
    };
  }
  return ctx;
}
