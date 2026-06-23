import { describe, it, expect } from '@jest/globals';
import {
  EXPORT_HARD_CAP,
  EXPORT_TABLE_MAX_ROWS,
  clampRowsToHardCap,
  resolvePanelExportMaxRows,
} from '../exportPolicy.js';

describe('clampRowsToHardCap', () => {
  it('passes an empty array through untouched', () => {
    const rows: number[] = [];
    const result = clampRowsToHardCap(rows);
    expect(result.truncated).toBe(false);
    expect(result.originalCount).toBe(0);
    expect(result.cap).toBe(EXPORT_HARD_CAP);
    expect(result.rows).toBe(rows); // same reference, no copy
  });

  it('returns the same array reference when within the cap', () => {
    const rows = Array.from({ length: EXPORT_HARD_CAP }, (_, i) => i);
    const result = clampRowsToHardCap(rows);
    expect(result.truncated).toBe(false);
    expect(result.originalCount).toBe(EXPORT_HARD_CAP);
    expect(result.rows).toBe(rows);
    expect(result.rows.length).toBe(EXPORT_HARD_CAP);
  });

  it('truncates to the cap, preserving order, when over the cap', () => {
    const rows = Array.from({ length: EXPORT_HARD_CAP + 5 }, (_, i) => i);
    const result = clampRowsToHardCap(rows);
    expect(result.truncated).toBe(true);
    expect(result.originalCount).toBe(EXPORT_HARD_CAP + 5);
    expect(result.cap).toBe(EXPORT_HARD_CAP);
    expect(result.rows.length).toBe(EXPORT_HARD_CAP);
    expect(result.rows).not.toBe(rows); // sliced copy
    expect(result.rows[0]).toBe(0);
    expect(result.rows[EXPORT_HARD_CAP - 1]).toBe(EXPORT_HARD_CAP - 1); // last kept row
  });
});

// Guard the invariant the clamp relies on: the per-type panel ceiling never
// exceeds the hard cap, so clampRowsToHardCap is a no-op on the SQL panel path.
describe('resolvePanelExportMaxRows stays within the hard cap', () => {
  it('caps the table ceiling at EXPORT_HARD_CAP even with a huge override', () => {
    expect(resolvePanelExportMaxRows('table')).toBe(EXPORT_TABLE_MAX_ROWS);
    expect(resolvePanelExportMaxRows('table', 10_000_000)).toBe(EXPORT_HARD_CAP);
    expect(resolvePanelExportMaxRows('table', 10_000_000)).toBeLessThanOrEqual(EXPORT_HARD_CAP);
  });
});
