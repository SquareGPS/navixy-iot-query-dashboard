import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DATE_FORMAT_VALUES,
  DatetimePrefs,
  TIME_FORMAT_VALUES,
  detectDefaultPrefs,
  detectInitialTimeFormat,
} from '@/utils/datetime';
import { useAuth } from '@/contexts/AuthContext';
import type { ServerPreferences } from '@/contexts/AuthContext';

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
      // Legacy 'default' and missing values map to 'dd/mm/yyyy', which is the
      // shape the previous dropdown label promised ("01/12/2021 (DD/MM/YYYY)").
      dateFormat: (DATE_FORMAT_VALUES as readonly string[]).includes(
        parsed.dateFormat as string,
      )
        ? (parsed.dateFormat as DatetimePrefs['dateFormat'])
        : 'dd/mm/yyyy',
      // Legacy 'default' and missing values seed from the auto-detected
      // hourCycle so users who never opened Settings still see the clock style
      // their locale conventionally uses.
      timeFormat: (TIME_FORMAT_VALUES as readonly string[]).includes(
        parsed.timeFormat as string,
      )
        ? (parsed.timeFormat as DatetimePrefs['timeFormat'])
        : detectInitialTimeFormat(),
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

function applyServerPreferences(
  data: ServerPreferences,
  setPrefsState: React.Dispatch<React.SetStateAction<DatetimePrefs>>,
) {
  setPrefsState((prev) => {
    const next: DatetimePrefs = { ...prev };
    let changed = false;
    if (typeof data.timezone === 'string' && data.timezone.trim().length > 0) {
      if (next.timeZone !== data.timezone) {
        next.timeZone = data.timezone;
        changed = true;
      }
    }
    if (
      data.dateFormat &&
      (DATE_FORMAT_VALUES as readonly string[]).includes(data.dateFormat) &&
      next.dateFormat !== data.dateFormat
    ) {
      next.dateFormat = data.dateFormat as DatetimePrefs['dateFormat'];
      changed = true;
    }
    if (
      data.timeFormat &&
      (TIME_FORMAT_VALUES as readonly string[]).includes(data.timeFormat) &&
      next.timeFormat !== data.timeFormat
    ) {
      next.timeFormat = data.timeFormat as DatetimePrefs['timeFormat'];
      changed = true;
    }
    return changed ? next : prev;
  });
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
