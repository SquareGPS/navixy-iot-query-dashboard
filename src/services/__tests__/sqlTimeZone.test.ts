import { describe, it, expect, afterEach } from 'vitest';
import { resolveSqlTimeZone, setSqlTimeZonePreference } from '../sqlTimeZone';

const hostZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// Module state persists across tests; always restore the unset default.
afterEach(() => setSqlTimeZonePreference(undefined));

describe('resolveSqlTimeZone', () => {
  it('falls back to the host zone before any preference is pushed', () => {
    expect(resolveSqlTimeZone()).toBe(hostZone());
  });

  it('returns the pushed explicit preference', () => {
    setSqlTimeZonePreference('Asia/Tokyo');
    expect(resolveSqlTimeZone()).toBe('Asia/Tokyo');
  });

  it("resolves a pushed 'auto' to the host zone", () => {
    setSqlTimeZonePreference('auto');
    expect(resolveSqlTimeZone()).toBe(hostZone());
  });

  it('follows preference changes (Settings save, server prefs merge)', () => {
    setSqlTimeZonePreference('Asia/Tokyo');
    setSqlTimeZonePreference('Europe/Berlin');
    expect(resolveSqlTimeZone()).toBe('Europe/Berlin');
    setSqlTimeZonePreference(undefined);
    expect(resolveSqlTimeZone()).toBe(hostZone());
  });
});
