import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DatetimePrefs,
  detectDefaultPrefs,
} from '@/utils/datetime';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';

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
    const parsed = JSON.parse(raw) as Partial<DatetimePrefs>;
    if (!parsed || typeof parsed !== 'object') return null;
    const defaults = detectDefaultPrefs();
    return {
      locale: typeof parsed.locale === 'string' ? parsed.locale : defaults.locale,
      timeZone:
        typeof parsed.timeZone === 'string' ? parsed.timeZone : defaults.timeZone,
      hourCycle:
        parsed.hourCycle === 'h12' || parsed.hourCycle === 'h23'
          ? parsed.hourCycle
          : defaults.hourCycle,
      dateStyle:
        parsed.dateStyle === 'short' ||
        parsed.dateStyle === 'medium' ||
        parsed.dateStyle === 'long'
          ? parsed.dateStyle
          : defaults.dateStyle,
    };
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

export function DatetimePrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<DatetimePrefs>(() => {
    return readFromStorage() ?? detectDefaultPrefs();
  });

  useEffect(() => {
    writeToStorage(prefs);
  }, [prefs]);

  const setPrefs = useCallback((next: Partial<DatetimePrefs>) => {
    setPrefsState((prev) => ({ ...prev, ...next }));
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefsState(detectDefaultPrefs());
  }, []);

  // Sync the server-side `timezone` preference once per authenticated
  // session. The backend is the source of truth for this field because
  // the same account can be used from multiple browsers; local storage
  // only acts as a warm cache for first render.
  const { user } = useAuth();
  const lastSyncedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      lastSyncedUserId.current = null;
      return;
    }
    if (lastSyncedUserId.current === user.id) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getUserPreferences();
        if (cancelled) return;
        const tz = res?.data?.timezone;
        if (typeof tz === 'string' && tz.trim().length > 0) {
          setPrefsState((prev) =>
            prev.timeZone === tz ? prev : { ...prev, timeZone: tz },
          );
        }
        lastSyncedUserId.current = user.id;
      } catch {
        // Network / auth error: silently keep current prefs.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
