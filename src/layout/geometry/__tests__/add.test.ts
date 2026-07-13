import { describe, it, expect } from 'vitest';
import { placeNewPanel, clampSizeToMin, getMinSize, MIN_BY_TYPE, DEFAULT_SIZE_BY_TYPE } from '../add';
import type { Dashboard } from '@/types/dashboard-types';

const emptyDash = (): Dashboard => ({ title: 'test', time: { from: '', to: '' }, panels: [] });

// On an empty dashboard the created panel is the only one present.
const created = (d: Dashboard) => d.panels[0].gridPos;

describe('clampSizeToMin (DO-317)', () => {
  it('bumps a below-minimum table up to its 12x8 floor', () => {
    expect(clampSizeToMin('table', { w: 6, h: 4 })).toEqual({ w: 12, h: 8 });
  });

  it('bumps only the dimension below the floor (barchart width already meets its min)', () => {
    // Small preset 6x4: width 6 meets barchart's min width 6; height 4 < 6 is raised.
    expect(clampSizeToMin('barchart', { w: 6, h: 4 })).toEqual({ w: 6, h: 6 });
  });

  it('leaves a size already at or above the floor untouched', () => {
    expect(clampSizeToMin('table', { w: 24, h: 8 })).toEqual({ w: 24, h: 8 });
    expect(clampSizeToMin('stat', { w: 6, h: 4 })).toEqual({ w: 6, h: 4 });
  });

  it('falls back to the default floor for an unknown type', () => {
    expect(clampSizeToMin('geomap', { w: 1, h: 1 })).toEqual(MIN_BY_TYPE.default);
  });

  it('never exceeds the 24-column grid width', () => {
    expect(clampSizeToMin('table', { w: 40, h: 8 }).w).toBe(24);
  });

  it('is idempotent', () => {
    const once = clampSizeToMin('table', { w: 6, h: 4 });
    expect(clampSizeToMin('table', once)).toEqual(once);
  });
});

describe('getMinSize (single source of truth for creation + resize floors)', () => {
  it('returns the per-type minimum', () => {
    expect(getMinSize('table')).toEqual({ w: 12, h: 8 });
    // bargauge lives only in this canonical table; resize.ts now shares it.
    expect(getMinSize('bargauge')).toEqual({ w: 6, h: 6 });
  });

  it('falls back to the default floor for unknown or unspecified types', () => {
    expect(getMinSize('geomap')).toEqual(MIN_BY_TYPE.default);
    expect(getMinSize(undefined)).toEqual(MIN_BY_TYPE.default);
  });
});

describe('placeNewPanel clamps a new panel to its minimum size (DO-317)', () => {
  it('creates a Small table at its 12x8 minimum, not the picked 6x4', () => {
    const d = placeNewPanel(emptyDash(), {
      type: 'table',
      size: { w: 6, h: 4 },
      hint: { position: { x: 0, y: 0 } },
    });
    expect(created(d)).toMatchObject({ w: 12, h: 8 });
  });

  it('raises a Small bar chart height to its 6-row minimum', () => {
    const d = placeNewPanel(emptyDash(), {
      type: 'barchart',
      size: { w: 6, h: 4 },
      hint: { position: { x: 0, y: 0 } },
    });
    expect(created(d)).toMatchObject({ w: 6, h: 6 });
  });

  it('leaves a type default (already >= its min) unchanged', () => {
    // No explicit size -> DEFAULT_SIZE_BY_TYPE.table (24x8), already above the 12x8 min.
    const d = placeNewPanel(emptyDash(), { type: 'table', hint: { position: { x: 0, y: 0 } } });
    expect(created(d)).toMatchObject(DEFAULT_SIZE_BY_TYPE.table);
  });

  it('pulls x back in-grid when the min-width bump would overflow the right edge', () => {
    // A Small (6-wide) table dropped at x=20 is bumped to 12 wide; 20 + 12 = 32
    // overflows the 24-column grid, so clampToBounds must pull x back to 24 - 12 = 12.
    const d = placeNewPanel(emptyDash(), {
      type: 'table',
      size: { w: 6, h: 4 },
      hint: { position: { x: 20, y: 0 } },
    });
    expect(created(d)).toMatchObject({ x: 12, y: 0, w: 12, h: 8 });
    const g = created(d);
    expect(g.x + g.w).toBeLessThanOrEqual(24);
  });
});
