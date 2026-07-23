/**
 * @vitest-environment jsdom
 *
 * The regression the DO-352 round-5 review asked for: the host (OS) zone
 * changes while the stored preference remains `'auto'`, and the hook that
 * feeds the execution cache key / effect deps / export requests must pick
 * the change up at the documented observation points instead of staying
 * pinned to the first sample the way the previous `useMemo` did.
 *
 * jsdom is scoped to this file via the pragma above — the rest of the suite
 * stays on the node environment.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useEffectiveTimeZone } from '../use-effective-time-zone';
import {
  __resetObservedHostZoneForTests,
  formatTimestamp,
} from '@/utils/datetime';
import {
  resolveSqlTimeZone,
  setSqlTimeZonePreference,
} from '@/services/sqlTimeZone';

// ---------------------------------------------------------------------------
// Host-zone stub. `resolveEffectiveTimeZone` reads the host zone with
// `Intl.DateTimeFormat().resolvedOptions().timeZone` (no arguments), while
// `sanitizeStoredTimeZone` validates candidate names by constructing
// `new Intl.DateTimeFormat('en', { timeZone })`. The stub redirects only the
// former — construction and validation stay real, so invalid names still
// throw the real RangeError.
// ---------------------------------------------------------------------------
const realDateTimeFormat = Intl.DateTimeFormat;
let hostZone = 'Europe/Berlin';

function stubbedDateTimeFormat(
  this: unknown,
  ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
) {
  const formatter = new realDateTimeFormat(...args);
  if (!args[1]?.timeZone) {
    const real = formatter.resolvedOptions.bind(formatter);
    formatter.resolvedOptions = () => ({ ...real(), timeZone: hostZone });
  }
  // Returning an object makes both call forms behave identically — the
  // host-zone read uses the no-`new` form.
  return formatter;
}

beforeEach(() => {
  hostZone = 'Europe/Berlin';
  Intl.DateTimeFormat =
    stubbedDateTimeFormat as unknown as typeof Intl.DateTimeFormat;
});

afterEach(() => {
  Intl.DateTimeFormat = realDateTimeFormat;
  cleanup();
  vi.restoreAllMocks();
  // The hook records every sample as the observed host zone (round 6);
  // forget it so no test inherits another's observation.
  __resetObservedHostZoneForTests();
});

describe('useEffectiveTimeZone', () => {
  it("re-samples a changed host zone on window focus while the preference stays 'auto'", () => {
    const { result } = renderHook(() => useEffectiveTimeZone('auto'));
    expect(result.current[0]).toBe('Europe/Berlin');

    hostZone = 'America/New_York';
    // No event has announced the change yet: the value intentionally holds
    // until an observation point — this is what keeps it usable as a cache
    // key between renders.
    expect(result.current[0]).toBe('Europe/Berlin');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current[0]).toBe('America/New_York');
  });

  it('re-samples on document visibilitychange', () => {
    const { result } = renderHook(() => useEffectiveTimeZone('auto'));
    expect(result.current[0]).toBe('Europe/Berlin');

    hostZone = 'Asia/Tokyo';
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current[0]).toBe('Asia/Tokyo');
  });

  it('re-samples on the proposed timezonechange event', () => {
    const { result } = renderHook(() => useEffectiveTimeZone('auto'));

    hostZone = 'Asia/Tokyo';
    act(() => {
      window.dispatchEvent(new Event('timezonechange'));
    });
    expect(result.current[0]).toBe('Asia/Tokyo');
  });

  it('keeps a named preference pinned across host-zone changes', () => {
    const { result } = renderHook(() => useEffectiveTimeZone('Europe/Belgrade'));
    expect(result.current[0]).toBe('Europe/Belgrade');

    hostZone = 'America/New_York';
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current[0]).toBe('Europe/Belgrade');
  });

  it('resolves a legacy bare-offset preference through the host zone and tracks changes', () => {
    // Round-4 composition: '+05:00' fails sanitizeStoredTimeZone, so the
    // effective zone is the host's — and must follow the host when it moves.
    const { result } = renderHook(() => useEffectiveTimeZone('+05:00'));
    expect(result.current[0]).toBe('Europe/Berlin');

    hostZone = 'America/New_York';
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current[0]).toBe('America/New_York');
  });

  it('resample() returns the fresh zone and syncs the state without any event', () => {
    // The auto-refresh interval and the export path call this directly —
    // neither involves an interaction that would fire focus/visibility.
    const { result } = renderHook(() => useEffectiveTimeZone('auto'));
    expect(result.current[0]).toBe('Europe/Berlin');

    hostZone = 'Asia/Tokyo';
    let returned: string | undefined;
    act(() => {
      returned = result.current[1]();
    });
    expect(returned).toBe('Asia/Tokyo');
    expect(result.current[0]).toBe('Asia/Tokyo');
  });

  it('re-resolves when the preference itself changes', () => {
    const { result, rerender } = renderHook(
      ({ tz }: { tz: string | undefined }) => useEffectiveTimeZone(tz),
      { initialProps: { tz: 'auto' as string | undefined } },
    );
    expect(result.current[0]).toBe('Europe/Berlin');

    rerender({ tz: 'Europe/Belgrade' });
    expect(result.current[0]).toBe('Europe/Belgrade');

    rerender({ tz: 'auto' });
    expect(result.current[0]).toBe('Europe/Berlin');
  });

  // -------------------------------------------------------------------------
  // Round-6 regression: the zone the hook resolves must be the zone
  // formatTimestamp renders with — in the same render, regardless of the
  // formatter key's own once-per-second host sample. The stub redirects the
  // sampler while process.env.TZ moves what real formatters output; both are
  // flipped together so they describe one host-zone change.
  // -------------------------------------------------------------------------
  const AUTO_PREFS = {
    locale: 'en-GB',
    timeZone: 'auto' as const,
    hourCycle: 'h23' as const,
    dateStyle: 'short' as const,
    dateFormat: 'yyyy-mm-dd' as const,
    timeFormat: 'h24' as const,
  };
  // Winter instant: Berlin renders 11:00 (UTC+1), Tokyo 19:00 (UTC+9).
  const instant = new Date('2026-01-15T10:00:00Z');

  /** Flip everything that means "the OS zone is now `zone`". */
  function setHostZone(zone: string): void {
    hostZone = zone;
    process.env.TZ = zone;
  }

  function withFrozenClockAndTz(run: () => void): void {
    const originalTz = process.env.TZ;
    vi.useFakeTimers();
    try {
      run();
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
      vi.useRealTimers();
    }
  }

  it('formats raw timestamps in the zone the rerun resolved, inside the formatter-sample TTL', () => {
    // The review's deterministic sequence: warm the 'auto' formatter, change
    // the host zone within the one-second sample TTL, detect it via focus
    // (which supersedes the SQL run), and require the render of that fast
    // result to format raw timestamps in the new zone — previously the
    // still-fresh sample kept them on the old one, indefinitely.
    withFrozenClockAndTz(() => {
      setHostZone('Europe/Berlin');
      setSqlTimeZonePreference('auto');

      const { result } = renderHook(() => useEffectiveTimeZone('auto'));
      expect(result.current[0]).toBe('Europe/Berlin');
      // Warm the 'auto' formatter (and, pre-fix, the fresh host sample).
      expect(formatTimestamp(instant, AUTO_PREFS)).toBe('2026-01-15 11:00');

      // The OS zone moves; the frozen clock keeps us inside the TTL.
      setHostZone('Asia/Tokyo');

      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      // The rerun side: the state that re-keys and re-runs the queries, and
      // the zone the superseding requests carry, both resolved Tokyo…
      expect(result.current[0]).toBe('Asia/Tokyo');
      expect(resolveSqlTimeZone()).toBe('Asia/Tokyo');
      // …and the same render formats raw timestamp cells in Tokyo too.
      expect(formatTimestamp(instant, AUTO_PREFS)).toBe('2026-01-15 19:00');
    });
  });

  it('between observation points, formatting holds with the state instead of drifting ahead', () => {
    // The reverse split: once the sample aged out, an unrelated re-render
    // used to move raw timestamps to the new zone while the state keying
    // the SQL runs still held the old one. Formatting must wait for the
    // observation point that also re-runs the queries.
    withFrozenClockAndTz(() => {
      setHostZone('Europe/Berlin');

      const { result } = renderHook(() => useEffectiveTimeZone('auto'));
      expect(formatTimestamp(instant, AUTO_PREFS)).toBe('2026-01-15 11:00');

      setHostZone('Asia/Tokyo');
      vi.advanceTimersByTime(1_001); // past the formatter's host-sample TTL

      expect(result.current[0]).toBe('Europe/Berlin');
      expect(formatTimestamp(instant, AUTO_PREFS)).toBe('2026-01-15 11:00');

      act(() => {
        window.dispatchEvent(new Event('focus'));
      });
      expect(result.current[0]).toBe('Asia/Tokyo');
      expect(formatTimestamp(instant, AUTO_PREFS)).toBe('2026-01-15 19:00');
    });
  });

  it('detaches all listeners on unmount', () => {
    const windowRemovals = vi.spyOn(window, 'removeEventListener');
    const documentRemovals = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useEffectiveTimeZone('auto'));
    unmount();

    const windowTypes = windowRemovals.mock.calls.map(([type]) => type);
    expect(windowTypes).toContain('focus');
    expect(windowTypes).toContain('timezonechange');
    expect(
      documentRemovals.mock.calls.map(([type]) => type),
    ).toContain('visibilitychange');

    // Dispatching after unmount must not touch the unmounted hook.
    hostZone = 'America/New_York';
    expect(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    }).not.toThrow();
  });
});
