import { describe, it, expect } from '@jest/globals';
import type { Pool } from 'pg';
import {
  readUserPreferences,
  resolveExportPreferences,
  validatePreferencesPatch,
  writeUserPreferences,
} from '../userPreferences.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

/**
 * DO-352 review: the export zone feeds the SQL session of the server-side
 * re-query, so it must obey the same rules as the live path (sanitizeTimeZone)
 * — in particular, bare "+05:00" offsets are Intl-valid but Postgres reads
 * them with the POSIX inverted sign, so they must never survive resolution.
 *
 * A bare `{}` request works as the AuthenticatedRequest here: when the body
 * value is dropped, resolveExportPreferences falls through to
 * getUserExportPreferences, which returns {} for a request without
 * settingsPool/user instead of touching a database.
 */
const bareReq = {} as AuthenticatedRequest;

describe('resolveExportPreferences timezone validation', () => {
  it('accepts an IANA name from the body', async () => {
    const prefs = await resolveExportPreferences(bareReq, {
      timeZone: 'Europe/Berlin',
      dateFormat: 'dd/mm/yyyy',
      timeFormat: 'h24',
    });
    expect(prefs.timeZone).toBe('Europe/Berlin');
  });

  it.each(['+05:00', '-08:00', '+02'])(
    'drops the bare offset %s from the body',
    async (tz) => {
      const prefs = await resolveExportPreferences(bareReq, {
        timeZone: tz,
        dateFormat: 'dd/mm/yyyy',
        timeFormat: 'h24',
      });
      expect(prefs.timeZone).toBeUndefined();
      // The other fields still resolve — only the zone is rejected.
      expect(prefs.dateFormat).toBe('dd/mm/yyyy');
      expect(prefs.timeFormat).toBe('h24');
    },
  );

  it('drops injection-shaped and non-string zones', async () => {
    for (const tz of ["Europe/Berlin'; DROP TABLE users; --", 42, null, { timeZone: 'UTC' }]) {
      const prefs = await resolveExportPreferences(bareReq, {
        timeZone: tz,
        dateFormat: 'dd/mm/yyyy',
        timeFormat: 'h24',
      });
      expect(prefs.timeZone).toBeUndefined();
    }
  });
});

describe('validatePreferencesPatch (PUT /user/preferences body)', () => {
  it('accepts and trim-normalizes an IANA name', () => {
    expect(validatePreferencesPatch({ timezone: '  Europe/Berlin  ' })).toEqual({
      timezone: 'Europe/Berlin',
    });
  });

  it.each(['+05:00', '-08:00', '+02'])(
    'rejects the bare offset %s on write with a 400',
    (tz) => {
      // Intl would accept these, but the SQL session guard refuses them —
      // persisting one would split frontend formatting from SQL rendering
      // the moment the preference hydrates (DO-352 review round 3).
      expect(() => validatePreferencesPatch({ timezone: tz })).toThrow(
        /Invalid timezone identifier/,
      );
    },
  );

  it('rejects unknown names, empty strings, and non-strings', () => {
    expect(() => validatePreferencesPatch({ timezone: 'Nowhere/Special' })).toThrow(
      /Invalid timezone identifier/,
    );
    expect(() => validatePreferencesPatch({ timezone: '   ' })).toThrow(
      /non-empty string/,
    );
    expect(() => validatePreferencesPatch({ timezone: 42 })).toThrow(
      /non-empty string/,
    );
  });

  it('validates dateFormat and timeFormat against the allowed values', () => {
    expect(validatePreferencesPatch({ dateFormat: 'dd/mm/yyyy', timeFormat: 'h24' })).toEqual({
      dateFormat: 'dd/mm/yyyy',
      timeFormat: 'h24',
    });
    expect(() => validatePreferencesPatch({ dateFormat: 'yy/mm' })).toThrow(/Invalid dateFormat/);
    expect(() => validatePreferencesPatch({ timeFormat: 'h25' })).toThrow(/Invalid timeFormat/);
  });

  it('requires at least one recognized field', () => {
    expect(() => validatePreferencesPatch({})).toThrow(/At least one/);
    expect(() => validatePreferencesPatch({ unrelated: true })).toThrow(/At least one/);
  });
});

/** A Pool whose single client answers every query with the given rows. */
function fakePool(rows: unknown[]): Pool {
  return {
    connect: async () => ({
      query: async () => ({ rows }),
      release: () => undefined,
    }),
  } as unknown as Pool;
}

describe('legacy stored timezone normalization on read', () => {
  it('readUserPreferences ignores a stored bare offset as if unset', async () => {
    // Rows written before validatePreferencesPatch guarded the PUT route may
    // hold "+05:00"; hydrating it would render raw timestamps at UTC+5 while
    // the SQL session (which refuses offsets) stays on the server default.
    const pool = fakePool([
      { raw_user_meta_data: { preferences: { timezone: '+05:00', dateFormat: 'dd/mm/yyyy', timeFormat: 'h24' } } },
    ]);
    const prefs = await readUserPreferences(pool, 'u1');
    expect(prefs.timezone).toBe('');
    // Only the zone is ignored — the other fields survive.
    expect(prefs.dateFormat).toBe('dd/mm/yyyy');
    expect(prefs.timeFormat).toBe('h24');
  });

  it('readUserPreferences keeps a stored IANA name', async () => {
    const pool = fakePool([
      { raw_user_meta_data: { preferences: { timezone: 'Europe/Berlin' } } },
    ]);
    const prefs = await readUserPreferences(pool, 'u1');
    expect(prefs.timezone).toBe('Europe/Berlin');
  });

  it('writeUserPreferences readback drops a legacy offset the patch left in place', async () => {
    // A patch that only touches dateFormat merges into a row that still has
    // the legacy zone; the RETURNING readback must not hand it back out.
    const pool = fakePool([
      { preferences: { timezone: '+05:00', dateFormat: 'yyyy-mm-dd', timeFormat: 'h12' } },
    ]);
    const saved = await writeUserPreferences(pool, 'u1', { dateFormat: 'yyyy-mm-dd' });
    expect(saved).not.toBeNull();
    expect(saved!.timezone).toBe('');
    expect(saved!.dateFormat).toBe('yyyy-mm-dd');
  });
});
