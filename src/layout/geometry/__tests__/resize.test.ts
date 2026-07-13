import { describe, it, expect } from 'vitest';
import { resizeRectFromHandle } from '../resize';
import type { GridPos } from '../grid';

const CONTAINER = 1200; // 24 columns @ 50px

// resize.ts no longer keeps its own MIN_BY_TYPE — it resolves the minimum through
// add.ts's getMinSize, so creation and resize share one table (DO-317 follow-up).
// The only behavioural change is bargauge: absent from resize's old private copy,
// it floored at the 4x4 default; it now floors at its real 6x6 minimum.
describe('resize honours the unified MIN_BY_TYPE floor (DO-317 follow-up)', () => {
  it('floors a bar gauge at 6x6 on resize, matching its creation minimum', () => {
    const rect: GridPos = { x: 0, y: 0, w: 12, h: 8 };
    // Drag the SE corner far past the origin; both dimensions hit the floor.
    const out = resizeRectFromHandle(rect, 'se', { x: -100000, y: -100000 }, CONTAINER, 'bargauge');
    expect(out).toMatchObject({ w: 6, h: 6 });
  });

  it('still floors a table at 12x8 (identical in both maps — unchanged by the dedup)', () => {
    const rect: GridPos = { x: 0, y: 0, w: 24, h: 12 };
    const out = resizeRectFromHandle(rect, 'se', { x: -100000, y: -100000 }, CONTAINER, 'table');
    expect(out).toMatchObject({ w: 12, h: 8 });
  });

  it('falls back to the 4x4 default floor for a type with no explicit minimum', () => {
    const rect: GridPos = { x: 0, y: 0, w: 12, h: 8 };
    const out = resizeRectFromHandle(rect, 'se', { x: -100000, y: -100000 }, CONTAINER, 'geomap');
    expect(out).toMatchObject({ w: 4, h: 4 });
  });
});
