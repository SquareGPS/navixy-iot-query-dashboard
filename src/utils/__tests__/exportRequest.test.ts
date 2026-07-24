import { describe, expect, it } from 'vitest';
import {
  buildExportZoneFields,
  normaliseUsedParams,
} from '../exportRequest';

// Round-8 export coherence: an export re-runs the query server-side, so the
// naive datetime parameters and the request's declared session zone must
// describe ONE zone. buildExportZoneFields takes a single zone and feeds it to
// both halves, so the two cannot straddle a host-zone change the render state
// has not observed yet. The reviewer's own numbers: 09:00 read as Berlin
// (UTC+1 in January) is 08:00Z, read as Tokyo (UTC+9) is 00:00Z.
const SQL = 'SELECT * FROM t WHERE ts >= ${date_from} AND ts < ${date_to}';

describe('buildExportZoneFields', () => {
  it('normalizes datetime params in the SAME zone it reports in prefs', () => {
    const tokyo = buildExportZoneFields({
      sqlQuery: SQL,
      parameterValues: { date_from: '2026-01-15T09:00', date_to: '2026-01-16T09:00' },
      timeZone: 'Asia/Tokyo',
      dateFormat: 'yyyy-mm-dd',
      timeFormat: 'h24',
    });
    expect(tokyo.params.date_from).toBe('2026-01-15T00:00:00.000Z');
    expect(tokyo.params.date_to).toBe('2026-01-16T00:00:00.000Z');
    expect(tokyo.prefs.timeZone).toBe('Asia/Tokyo');
    expect(tokyo.prefs.dateFormat).toBe('yyyy-mm-dd');
    expect(tokyo.prefs.timeFormat).toBe('h24');
  });

  it('moves the param instant and the declared zone together, never apart', () => {
    // The exact split the review reproduced: same naive value, different zone.
    // Both halves must reflect whichever single zone is passed — the params
    // eight hours apart, the declared zone matching each.
    const berlin = buildExportZoneFields({
      sqlQuery: SQL,
      parameterValues: { date_from: '2026-01-15T09:00' },
      timeZone: 'Europe/Berlin',
    });
    const tokyo = buildExportZoneFields({
      sqlQuery: SQL,
      parameterValues: { date_from: '2026-01-15T09:00' },
      timeZone: 'Asia/Tokyo',
    });

    expect(berlin.params.date_from).toBe('2026-01-15T08:00:00.000Z');
    expect(berlin.prefs.timeZone).toBe('Europe/Berlin');
    expect(tokyo.params.date_from).toBe('2026-01-15T00:00:00.000Z');
    expect(tokyo.prefs.timeZone).toBe('Asia/Tokyo');

    // The eight-hour parameter gap is exactly the offset between the two zones
    // the reviewer named — proving the params followed the declared zone, not
    // a second independent read.
    const gapHours =
      (new Date(berlin.params.date_from as string).getTime() -
        new Date(tokyo.params.date_from as string).getTime()) /
      3_600_000;
    expect(gapHours).toBe(8);
  });

  it('omits an absent zone from prefs and interprets naive params host-locally', () => {
    // Intl-unusable host: timeZone falls out of the request (backend applies
    // its session default), and a naive value keeps its legacy host-local
    // reading. An already-UTC-suffixed value is instant-fixed regardless of
    // host, so it stays a deterministic assertion here.
    const fields = buildExportZoneFields({
      sqlQuery: SQL,
      parameterValues: { date_from: '2026-01-15T09:00:00Z' },
      timeZone: undefined,
      dateFormat: 'dd/mm/yyyy',
    });
    expect(fields.prefs.timeZone).toBeUndefined();
    expect(fields.prefs.dateFormat).toBe('dd/mm/yyyy');
    expect(fields.params.date_from).toBe('2026-01-15T09:00:00.000Z');
  });
});

describe('normaliseUsedParams', () => {
  it('drops params the SQL does not reference and skips empty values', () => {
    const out = normaliseUsedParams(
      SQL,
      {
        date_from: '2026-01-15T09:00',
        date_to: '   ', // whitespace-only → skipped
        unused: 'ignored', // not in SQL → dropped
      },
      'Asia/Tokyo',
    );
    expect(out).toEqual({ date_from: '2026-01-15T00:00:00.000Z' });
  });

  it('passes non-date params through unchanged', () => {
    const out = normaliseUsedParams(
      'SELECT * FROM t WHERE region = ${region}',
      { region: 'north' },
      'Asia/Tokyo',
    );
    expect(out).toEqual({ region: 'north' });
  });
});
