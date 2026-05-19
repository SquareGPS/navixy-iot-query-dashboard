import { describe, it, expect } from 'vitest';
import {
  detectDefaultPrefs,
  formatLocalInputInZone,
  formatTimestamp,
  isDateLikeParam,
  isTimestampLike,
  normaliseParamForApi,
  parseServerTimestamp,
  toUtcIso,
  toUtcIsoInZone,
} from '../datetime';

const prefsBerlin = {
  locale: 'de-DE',
  timeZone: 'Europe/Berlin',
  hourCycle: 'h23' as const,
  dateStyle: 'short' as const,
};

const prefsNY = {
  locale: 'en-US',
  timeZone: 'America/New_York',
  hourCycle: 'h12' as const,
  dateStyle: 'short' as const,
};

describe('isDateLikeParam', () => {
  it.each([
    'date_from',
    'date_to',
    'dateFrom',
    '__from',
    '__to',
    'from',
    'to',
    'since',
    'until',
    'created_at',
    'start_time',
    'period_from',
    'updated_at',
  ])('returns true for %s', (name) => {
    expect(isDateLikeParam(name)).toBe(true);
  });

  it.each(['vehicle_label', 'object_label', 'limit', 'page', 'status', 'name'])(
    'returns false for %s',
    (name) => {
      expect(isDateLikeParam(name)).toBe(false);
    },
  );
});

describe('toUtcIso', () => {
  it('converts a Date to ISO UTC', () => {
    expect(toUtcIso(new Date('2026-05-12T03:00:00Z'))).toBe(
      '2026-05-12T03:00:00.000Z',
    );
  });

  it('treats a datetime-local string as local wall-clock time', () => {
    // The result depends on host TZ — we just assert it parses to a valid ISO.
    const out = toUtcIso('2026-05-12T05:00');
    expect(out).toMatch(/^2026-05-1[12]T\d{2}:\d{2}:00\.000Z$/);
  });

  it('preserves explicit Z timestamps', () => {
    expect(toUtcIso('2026-05-12T05:00:00Z')).toBe('2026-05-12T05:00:00.000Z');
  });

  it('returns empty string for empty input', () => {
    expect(toUtcIso('')).toBe('');
  });
});

describe('parseServerTimestamp', () => {
  it('appends Z to naive timestamps so they are interpreted as UTC', () => {
    const d = parseServerTimestamp('2026-05-12 05:01:00');
    expect(d?.toISOString()).toBe('2026-05-12T05:01:00.000Z');
  });

  it('passes ISO with Z through unchanged', () => {
    const d = parseServerTimestamp('2026-05-12T05:01:00Z');
    expect(d?.toISOString()).toBe('2026-05-12T05:01:00.000Z');
  });

  it('respects explicit +HH:MM offsets', () => {
    const d = parseServerTimestamp('2026-05-12T07:01:00+02:00');
    expect(d?.toISOString()).toBe('2026-05-12T05:01:00.000Z');
  });

  it('returns null for garbage input', () => {
    expect(parseServerTimestamp('not a date')).toBeNull();
    expect(parseServerTimestamp('')).toBeNull();
  });
});

describe('isTimestampLike', () => {
  it.each([
    '2026-05-12',
    '2026-05-12 05:01:00',
    '2026-05-12T05:01:00',
    '2026-05-12T05:01:00Z',
    '2026-05-12T05:01:00.123Z',
    '2026-05-12T07:01:00+02:00',
  ])('returns true for %s', (s) => {
    expect(isTimestampLike(s)).toBe(true);
  });

  it.each(['Truck 1', '', '12345', '2026', 'not-a-date'])(
    'returns false for %s',
    (s) => {
      expect(isTimestampLike(s)).toBe(false);
    },
  );
});

describe('formatTimestamp', () => {
  const utcInstant = new Date('2026-05-12T03:00:00Z'); // 5:00 in Berlin (UTC+2 DST)

  it('renders Berlin local time', () => {
    expect(formatTimestamp(utcInstant, prefsBerlin)).toMatch(/12\.05\.2026.*05:00/);
  });

  it('renders New York local time', () => {
    expect(formatTimestamp(utcInstant, prefsNY)).toMatch(/05\/11\/2026.*11:00\s?PM/);
  });

  it('accepts a naive string (treats as UTC)', () => {
    expect(formatTimestamp('2026-05-12 03:00:00', prefsBerlin)).toMatch(
      /12\.05\.2026.*05:00/,
    );
  });

  it('returns empty for nullish or invalid input', () => {
    expect(formatTimestamp(null, prefsBerlin)).toBe('');
    expect(formatTimestamp('garbage', prefsBerlin)).toBe('');
  });

  it('omits time when includeTime=false', () => {
    expect(formatTimestamp(utcInstant, prefsBerlin, { includeTime: false })).toBe(
      '12.05.2026',
    );
  });
});

describe('normaliseParamForApi', () => {
  it('converts a date-like param string from local to UTC ISO', () => {
    const out = normaliseParamForApi('date_from', '2026-05-12T05:00');
    expect(out).toMatch(/^2026-05-1[12]T\d{2}:\d{2}:00\.000Z$/);
  });

  it('leaves non-date params untouched', () => {
    expect(normaliseParamForApi('vehicle_label', 'Truck 1')).toBe('Truck 1');
  });

  it('leaves explicit-Z dates alone (no double parse)', () => {
    expect(normaliseParamForApi('date_from', '2026-05-12T05:00:00Z')).toBe(
      '2026-05-12T05:00:00.000Z',
    );
  });

  it('passes through empty strings (caller decides what to do)', () => {
    expect(normaliseParamForApi('date_from', '')).toBe('');
    expect(normaliseParamForApi('date_from', null)).toBeNull();
    expect(normaliseParamForApi('date_from', undefined)).toBeUndefined();
  });
});

describe('toUtcIsoInZone', () => {
  it('interprets naive string as wall-clock in the given zone', () => {
    // 05:00 in Asia/Tokyo (UTC+9, no DST) → previous day 20:00 UTC.
    expect(toUtcIsoInZone('2026-05-12T05:00', 'Asia/Tokyo')).toBe(
      '2026-05-11T20:00:00.000Z',
    );
  });

  it('handles a DST-active zone (Europe/Belgrade in May is UTC+2)', () => {
    expect(toUtcIsoInZone('2026-05-12T05:00', 'Europe/Belgrade')).toBe(
      '2026-05-12T03:00:00.000Z',
    );
  });

  it('handles a DST winter date (Europe/Belgrade in January is UTC+1)', () => {
    expect(toUtcIsoInZone('2026-01-15T05:00', 'Europe/Belgrade')).toBe(
      '2026-01-15T04:00:00.000Z',
    );
  });

  it('supports zones west of UTC (America/New_York summer is UTC-4)', () => {
    expect(toUtcIsoInZone('2026-05-12T05:00', 'America/New_York')).toBe(
      '2026-05-12T09:00:00.000Z',
    );
  });

  it('accepts seconds and milliseconds', () => {
    expect(toUtcIsoInZone('2026-05-12T05:30:15.250', 'Asia/Tokyo')).toBe(
      '2026-05-11T20:30:15.250Z',
    );
  });

  it('returns empty string for empty input', () => {
    expect(toUtcIsoInZone('', 'Asia/Tokyo')).toBe('');
  });

  it('falls back to system parsing when timeZone is "auto" or omitted', () => {
    // We can't assert an exact value (depends on host TZ), only the shape.
    expect(toUtcIsoInZone('2026-05-12T05:00', 'auto')).toMatch(
      /^2026-05-1[12]T\d{2}:\d{2}:00\.000Z$/,
    );
    expect(toUtcIsoInZone('2026-05-12T05:00')).toMatch(
      /^2026-05-1[12]T\d{2}:\d{2}:00\.000Z$/,
    );
  });

  it('round-trips with formatLocalInputInZone for arbitrary zones', () => {
    const naive = '2026-05-12T05:00';
    for (const tz of ['Asia/Tokyo', 'Europe/Belgrade', 'America/New_York']) {
      const utc = toUtcIsoInZone(naive, tz);
      const back = formatLocalInputInZone(new Date(utc), tz);
      expect(back).toBe(naive);
    }
  });
});

describe('formatLocalInputInZone', () => {
  const utcInstant = new Date('2026-05-12T03:00:00Z');

  it('formats UTC instant as wall-clock in Tokyo', () => {
    expect(formatLocalInputInZone(utcInstant, 'Asia/Tokyo')).toBe(
      '2026-05-12T12:00',
    );
  });

  it('formats UTC instant as wall-clock in Belgrade (DST active)', () => {
    expect(formatLocalInputInZone(utcInstant, 'Europe/Belgrade')).toBe(
      '2026-05-12T05:00',
    );
  });

  it('falls back to host wall-clock when zone is "auto"', () => {
    // Result depends on host TZ — only assert shape.
    expect(formatLocalInputInZone(utcInstant, 'auto')).toMatch(
      /^2026-05-1[12]T\d{2}:\d{2}$/,
    );
  });

  it('returns empty for invalid Date', () => {
    expect(formatLocalInputInZone(new Date('invalid'), 'Asia/Tokyo')).toBe('');
  });
});

describe('normaliseParamForApi with explicit timeZone', () => {
  it('uses the supplied zone for naive datetime-local strings', () => {
    expect(
      normaliseParamForApi('date_from', '2026-05-12T05:00', {
        timeZone: 'Asia/Tokyo',
      }),
    ).toBe('2026-05-11T20:00:00.000Z');
  });

  it('ignores zone for non-date params', () => {
    expect(
      normaliseParamForApi('vehicle_label', '2026-05-12T05:00', {
        timeZone: 'Asia/Tokyo',
      }),
    ).toBe('2026-05-12T05:00');
  });

  it('ignores zone for values with an explicit suffix', () => {
    expect(
      normaliseParamForApi('date_from', '2026-05-12T05:00:00Z', {
        timeZone: 'Asia/Tokyo',
      }),
    ).toBe('2026-05-12T05:00:00.000Z');
  });
});

describe('detectDefaultPrefs', () => {
  it('returns a structurally valid prefs object', () => {
    const p = detectDefaultPrefs();
    expect(typeof p.locale).toBe('string');
    expect(p.timeZone).toBe('auto');
    expect(['h12', 'h23']).toContain(p.hourCycle);
    expect(['short', 'medium', 'long']).toContain(p.dateStyle);
  });
});
