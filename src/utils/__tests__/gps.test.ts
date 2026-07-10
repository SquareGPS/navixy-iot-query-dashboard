import { describe, it, expect } from 'vitest';
import { isDisplayableCoord } from '../gps';

describe('isDisplayableCoord', () => {
  it('accepts a normal in-range coordinate', () => {
    expect(isDisplayableCoord(51.5074, -0.1278)).toBe(true);
    expect(isDisplayableCoord(-33.8688, 151.2093)).toBe(true);
  });

  it('accepts the range extremes', () => {
    expect(isDisplayableCoord(90, 180)).toBe(true);
    expect(isDisplayableCoord(-90, -180)).toBe(true);
  });

  it('rejects the (0, 0) null-island sentinel', () => {
    expect(isDisplayableCoord(0, 0)).toBe(false);
  });

  it('keeps real points that sit on a single zero axis', () => {
    // London is on the prime meridian; a lone zero must not be treated as null island.
    expect(isDisplayableCoord(51.5, 0)).toBe(true);
    expect(isDisplayableCoord(0, 42)).toBe(true);
    expect(isDisplayableCoord(0, -0.0001)).toBe(true);
  });

  it('rejects out-of-range values', () => {
    expect(isDisplayableCoord(91, 0)).toBe(false);
    expect(isDisplayableCoord(-91, 0)).toBe(false);
    expect(isDisplayableCoord(10, 181)).toBe(false);
    expect(isDisplayableCoord(10, -181)).toBe(false);
  });

  it('rejects NaN and non-finite values', () => {
    expect(isDisplayableCoord(NaN, 10)).toBe(false);
    expect(isDisplayableCoord(10, NaN)).toBe(false);
    expect(isDisplayableCoord(Infinity, 10)).toBe(false);
    expect(isDisplayableCoord(10, -Infinity)).toBe(false);
  });
});
