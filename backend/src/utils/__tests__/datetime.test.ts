import { describe, it, expect } from '@jest/globals';
import {
  TIMESTAMP_LIKE_RE,
  isTimestampLikeValue,
  parseTimestampValue,
  sanitizeTimeZone,
} from '../datetime.js';

describe('sanitizeTimeZone', () => {
  it.each(['Europe/Berlin', 'UTC', 'Etc/GMT+2', 'America/Argentina/Buenos_Aires'])(
    'accepts the IANA name %s',
    (tz) => {
      expect(sanitizeTimeZone(tz)).toBe(tz);
    },
  );

  it('trims surrounding whitespace', () => {
    expect(sanitizeTimeZone('  Europe/Berlin  ')).toBe('Europe/Berlin');
  });

  it.each([
    'Nowhere/Special',
    'not a zone',
    // SET-style injection must never survive: the value only ever reaches the
    // database as a bind parameter, but rejecting it here keeps the log and
    // cache key clean too.
    "Europe/Berlin'; DROP TABLE users; --",
    '',
    '   ',
  ])('rejects the invalid name %s', (tz) => {
    expect(sanitizeTimeZone(tz)).toBeUndefined();
  });

  it('rejects names longer than 64 characters without calling Intl', () => {
    expect(sanitizeTimeZone(`Europe/${'x'.repeat(64)}`)).toBeUndefined();
  });

  it('rejects non-string values', () => {
    expect(sanitizeTimeZone(120)).toBeUndefined();
    expect(sanitizeTimeZone(null)).toBeUndefined();
    expect(sanitizeTimeZone(undefined)).toBeUndefined();
    expect(sanitizeTimeZone({ timeZone: 'Europe/Berlin' })).toBeUndefined();
    expect(sanitizeTimeZone(['Europe/Berlin'])).toBeUndefined();
  });
});

describe('isTimestampLikeValue', () => {
  it.each([
    '2026-05-12',
    '2026-05-12 05:01:00',
    '2026-05-12T05:01:00',
    '2026-05-12T05:01:00Z',
    '2026-05-12T05:01:00.123Z',
    '2026-05-12T07:01:00+02:00',
    '2026-05-12T07:01:00+0200',
  ])('returns true for ISO-like string %s', (s) => {
    expect(isTimestampLikeValue(s)).toBe(true);
  });

  it.each(['Truck 1', '', '12345', '2026', 'not-a-date', '2026/05/12'])(
    'returns false for non-ISO string %s',
    (s) => {
      expect(isTimestampLikeValue(s)).toBe(false);
    },
  );

  it('returns false for non-string values', () => {
    expect(isTimestampLikeValue(12345)).toBe(false);
    expect(isTimestampLikeValue(null)).toBe(false);
    expect(isTimestampLikeValue(undefined)).toBe(false);
    expect(isTimestampLikeValue(new Date())).toBe(false);
    expect(isTimestampLikeValue({})).toBe(false);
    expect(isTimestampLikeValue(['2026-05-12'])).toBe(false);
  });

  it('trims surrounding whitespace before matching', () => {
    expect(isTimestampLikeValue('  2026-05-12T05:01:00Z  ')).toBe(true);
  });
});

describe('parseTimestampValue', () => {
  it('treats a naive (suffix-less) timestamp as UTC', () => {
    expect(parseTimestampValue('2026-05-12 05:01:00')?.toISOString()).toBe(
      '2026-05-12T05:01:00.000Z',
    );
  });

  it('treats a naive date-only value as UTC midnight', () => {
    expect(parseTimestampValue('2026-05-12')?.toISOString()).toBe(
      '2026-05-12T00:00:00.000Z',
    );
  });

  it('passes an explicit-Z timestamp through unchanged', () => {
    expect(parseTimestampValue('2026-05-12T05:01:00Z')?.toISOString()).toBe(
      '2026-05-12T05:01:00.000Z',
    );
  });

  it('respects an explicit +HH:MM offset', () => {
    expect(parseTimestampValue('2026-05-12T07:01:00+02:00')?.toISOString()).toBe(
      '2026-05-12T05:01:00.000Z',
    );
  });

  it('treats a "T"-separated naive value as UTC', () => {
    expect(parseTimestampValue('2026-05-12T05:01:00')?.toISOString()).toBe(
      '2026-05-12T05:01:00.000Z',
    );
  });

  it('falls back to Date parsing for non-ISO strings (mirrors parseServerTimestamp)', () => {
    // The string must fail the strict ISO regex so it hits the
    // `new Date(trimmed)` fallback branch; the explicit GMT keeps it
    // deterministic regardless of the host timezone.
    expect(TIMESTAMP_LIKE_RE.test('Tue, 12 May 2026 05:01:00 GMT')).toBe(false);
    expect(
      parseTimestampValue('Tue, 12 May 2026 05:01:00 GMT')?.toISOString(),
    ).toBe('2026-05-12T05:01:00.000Z');
  });

  it('returns null for empty, whitespace-only, or garbage input', () => {
    expect(parseTimestampValue('')).toBeNull();
    expect(parseTimestampValue('   ')).toBeNull();
    expect(parseTimestampValue('not a date')).toBeNull();
  });
});