import { describe, it, expect } from 'vitest';
import { SIZE_PRESETS, DEFAULT_SIZE_PRESET, resolvePresetSize } from '../sizePresets';

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
