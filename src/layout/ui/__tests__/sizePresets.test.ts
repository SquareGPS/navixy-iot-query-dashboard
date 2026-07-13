import { describe, it, expect } from 'vitest';
import { SIZE_PRESETS, DEFAULT_SIZE_PRESET, resolvePresetSize, isPresetBelowMin } from '../sizePresets';
import { MIN_BY_TYPE } from '../../geometry/add';

describe('resolvePresetSize (DO-306)', () => {
  it('returns the exact dimensions the gallery advertises for each preset', () => {
    // The dropdown labels each option with these dimensions, so creation must
    // match them regardless of the panel type's own default size.
    expect(resolvePresetSize('Small')).toEqual({ w: 6, h: 4 });
    expect(resolvePresetSize('Medium')).toEqual({ w: 12, h: 8 });
    expect(resolvePresetSize('Large')).toEqual({ w: 24, h: 8 });
  });

  it('honours Large over a smaller type default (the reported regression)', () => {
    // Before the fix, a Bar Chart's 12×8 default clobbered the picked Large
    // preset. The preset must win.
    expect(resolvePresetSize('Large')).toEqual({ w: 24, h: 8 });
    expect(resolvePresetSize('Large')).not.toEqual({ w: 12, h: 8 });
  });

  it('falls back to the default preset for an unknown label', () => {
    const fallback = resolvePresetSize('Huge' as never);
    expect(fallback).toEqual(resolvePresetSize(DEFAULT_SIZE_PRESET));
    expect(fallback).toEqual({ w: 12, h: 8 });
  });

  it('every preset width fits within the 24-column grid', () => {
    for (const preset of SIZE_PRESETS) {
      expect(preset.w).toBeGreaterThanOrEqual(1);
      expect(preset.w).toBeLessThanOrEqual(24);
      expect(preset.h).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('isPresetBelowMin (DO-317 follow-up — gallery must not advertise a clamped size)', () => {
  it('flags a preset that creation would clamp up to the type floor', () => {
    // Table floors at 12×8, so "Small (6×4)" is below-min: the gallery greys it
    // out rather than show 6×4 and commit 12×8.
    expect(isPresetBelowMin('table', { w: 6, h: 4 })).toBe(true);
    // Bar/pie charts floor at 6×6, so Small's height 4 is below-min too.
    expect(isPresetBelowMin('barchart', { w: 6, h: 4 })).toBe(true);
    expect(isPresetBelowMin('piechart', { w: 6, h: 4 })).toBe(true);
  });

  it('passes a preset that already meets the type floor', () => {
    expect(isPresetBelowMin('table', { w: 12, h: 8 })).toBe(false);
    // Stat floors at 3×3, so the 6×4 Small preset clears it untouched.
    expect(isPresetBelowMin('stat', { w: 6, h: 4 })).toBe(false);
    // geomap has no explicit min, so it uses the 4×4 default — Small clears it.
    expect(isPresetBelowMin('geomap', { w: 6, h: 4 })).toBe(false);
  });

  it('the default reset preset clears every panel type floor', () => {
    // handleSelectType snaps a below-min pick back to DEFAULT_SIZE_PRESET, so the
    // default (and Large) must never themselves be below-min for any type — else
    // the reset would land on another lying option. Pin the invariant: if a future
    // MIN_BY_TYPE entry rises above Medium, this fails loudly.
    for (const type of Object.keys(MIN_BY_TYPE)) {
      expect(isPresetBelowMin(type, resolvePresetSize(DEFAULT_SIZE_PRESET))).toBe(false);
      expect(isPresetBelowMin(type, resolvePresetSize('Large'))).toBe(false);
    }
  });
});
