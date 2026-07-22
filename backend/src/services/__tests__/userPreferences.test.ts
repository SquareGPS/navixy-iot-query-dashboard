import { describe, it, expect } from '@jest/globals';
import { resolveExportPreferences } from '../userPreferences.js';
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
