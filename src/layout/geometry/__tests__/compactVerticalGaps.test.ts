import { describe, it, expect } from 'vitest';
import { compactVerticalGaps, normalizeDashboardLayout, canonicalizeRows } from '../rows';
import type { Dashboard, Panel } from '@/types/dashboard-types';

// Minimal helpers for building dashboard fixtures without the full schema noise.
function panel(
  id: string | number,
  type: string,
  pos: { x: number; y: number; w: number; h: number },
  extra: Partial<Panel> & { collapsed?: boolean; panels?: Panel[] } = {}
): Panel {
  return { id, type, title: String(id), gridPos: pos, ...extra } as unknown as Panel;
}

function dash(panels: Panel[]): Dashboard {
  return { title: 'test', time: { from: '', to: '' }, panels } as Dashboard;
}

const yById = (d: Dashboard, id: string | number) =>
  d.panels.find((p) => p.id === id)!.gridPos.y;

const ys = (d: Dashboard) =>
  d.panels.map((p) => `${p.id}@${p.gridPos.y}`).sort().join(',');

/** Any two top-level panels that share horizontal span must not share vertical span. */
function hasNoOverlaps(d: Dashboard): boolean {
  const ps = d.panels;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i].gridPos, b = ps[j].gridPos;
      const h = a.x < b.x + b.w && b.x < a.x + a.w;
      const v = a.y < b.y + b.h && b.y < a.y + a.h;
      if (h && v) return false;
    }
  }
  return true;
}

// Exact corrupt coordinates from the HW Asset Detail Dashboard (DO-279).
const corrupt = () =>
  dash([
    panel(100, 'text', { x: 0, y: 149, w: 24, h: 3 }),
    panel(1, 'geomap', { x: 0, y: 193, w: 12, h: 12 }),
    panel(2, 'table', { x: 12, y: 137, w: 12, h: 12 }),
    panel(3, 'timeseries', { x: 0, y: 180, w: 24, h: 13 }),
    panel(4, 'barchart', { x: 0, y: 166, w: 12, h: 14 }),
    panel(5, 'table', { x: 12, y: 123, w: 12, h: 14 }),
    panel(6, 'table', { x: 0, y: 152, w: 24, h: 14 }),
    panel(101, 'row', { x: 0, y: 56, w: 24, h: 1 }, { collapsed: false, panels: [] }),
    panel(102, 'row', { x: 0, y: 58, w: 24, h: 1 }, { collapsed: false, panels: [] }),
    panel(103, 'row', { x: 0, y: 106, w: 24, h: 1 }, { collapsed: false, panels: [] }),
    panel(104, 'row', { x: 0, y: 122, w: 24, h: 1 }, { collapsed: false, panels: [] }),
    panel(105, 'geomap', { x: 0, y: 137, w: 12, h: 10 }),
  ]);

describe('compactVerticalGaps', () => {
  it('rescues the DO-279 layout: dead space removed, content pulled to the top', () => {
    const out = compactVerticalGaps(corrupt());

    // First element at the very top; total height collapses from 205 to 89 units.
    expect(Math.min(...out.panels.map((p) => p.gridPos.y))).toBe(0);
    expect(Math.max(...out.panels.map((p) => p.gridPos.y + p.gridPos.h))).toBe(89);
    expect(hasNoOverlaps(out)).toBe(true);

    // Row headers keep a single empty grid row between them (the minimum the
    // editor relies on), so they sit at 0, 2, 4, 6 — not back-to-back.
    expect([101, 102, 103, 104].map((id) => yById(out, id))).toEqual([0, 2, 4, 6]);

    // Content keeps its relative arrangement, packed under the last row header.
    expect(yById(out, 5)).toBe(7);
    expect(yById(out, 2)).toBe(yById(out, 105)); // side-by-side pair stays aligned
    expect(yById(out, 1)).toBe(77); // last panel
  });

  it('only changes y — x/w/h are preserved', () => {
    const d = dash([
      panel(1, 'table', { x: 3, y: 10, w: 6, h: 4 }),
      panel(2, 'table', { x: 9, y: 10, w: 6, h: 2 }),
    ]);
    const out = compactVerticalGaps(d);
    expect(out.panels.find((p) => p.id === 1)!.gridPos).toEqual({ x: 3, y: 0, w: 6, h: 4 });
    expect(out.panels.find((p) => p.id === 2)!.gridPos).toEqual({ x: 9, y: 0, w: 6, h: 2 });
  });

  it('is idempotent and a fixed point of canonicalizeRows', () => {
    const once = compactVerticalGaps(corrupt());
    expect(ys(compactVerticalGaps(once))).toEqual(ys(once));
    // The renderer canonicalizes again on every render — that must not disturb it.
    expect(ys(canonicalizeRows(once))).toEqual(ys(once));
  });

  it('returns the same reference for an already-compact dashboard (no-op)', () => {
    const d = dash([
      panel(1, 'row', { x: 0, y: 0, w: 24, h: 1 }, { collapsed: false }),
      panel(2, 'table', { x: 0, y: 1, w: 12, h: 8 }),
      panel(3, 'table', { x: 12, y: 1, w: 12, h: 8 }),
    ]);
    expect(compactVerticalGaps(d)).toBe(d);
  });

  it('does not mutate its input', () => {
    const d = corrupt();
    const before = ys(d);
    compactVerticalGaps(d);
    expect(ys(d)).toBe(before);
  });

  it('leaves collapsed-row children untouched and ignores them in occupancy', () => {
    // A collapsed row at y=40 whose child carries relative coordinates; the only
    // top-level elements are the header (y=40, h=1) and a panel at y=60.
    const child = panel('c1', 'table', { x: 0, y: 0, w: 12, h: 6 });
    const d = dash([
      panel(1, 'row', { x: 0, y: 40, w: 24, h: 1 }, { collapsed: true, panels: [child] }),
      panel(2, 'table', { x: 0, y: 60, w: 24, h: 8 }),
    ]);
    const out = compactVerticalGaps(d);
    const row = out.panels.find((p) => p.id === 1)!;

    expect(row.gridPos.y).toBe(0); // header pulled to top (leading gap removed)
    expect(out.panels.find((p) => p.id === 2)!.gridPos.y).toBe(1); // packed under header
    // The child keeps its relative coordinates and is not hoisted into layout.
    expect(row.panels?.[0].gridPos).toEqual({ x: 0, y: 0, w: 12, h: 6 });
  });

  // The renderer compacts BEFORE `withIds` backfills uuids, so id-less top-level
  // panels reach this function. They must take part in compaction like any other
  // panel — DO-279 regression guard.
  const idless = (pos: { x: number; y: number; w: number; h: number }): Panel =>
    ({ type: 'text', title: 'no-id', gridPos: pos } as unknown as Panel);

  it('compacts id-less top-level panels instead of stranding them at a large y', () => {
    const out = compactVerticalGaps(dash([
      panel(1, 'table', { x: 0, y: 5, w: 24, h: 5 }),
      idless({ x: 0, y: 30, w: 24, h: 6 }), // below a big gap, no id yet
    ]));
    const idd = out.panels.find((p) => p.id === 1)!;
    const noid = out.panels.find((p) => p.id === undefined)!;

    expect(idd.gridPos.y).toBe(0);
    expect(noid.gridPos.y).toBe(5); // pulled up under the id'd panel, not left at 30
    expect(hasNoOverlaps(out)).toBe(true);
  });

  it('counts id-less panels in occupancy so neighbours never compact on top of them', () => {
    const out = compactVerticalGaps(dash([
      idless({ x: 0, y: 0, w: 24, h: 10 }), // full-width, no id
      panel(1, 'table', { x: 0, y: 20, w: 24, h: 5 }), // below a gap
    ]));
    // Without counting the id-less panel, panel 1 would compact to y=0 and overlap it.
    expect(hasNoOverlaps(out)).toBe(true);
    expect(out.panels.find((p) => p.id === 1)!.gridPos.y).toBe(10);
  });
});

describe('normalizeDashboardLayout', () => {
  it('produces a stable, overlap-free layout from corrupt input', () => {
    const out = normalizeDashboardLayout(corrupt());
    expect(Math.min(...out.panels.map((p) => p.gridPos.y))).toBe(0);
    expect(hasNoOverlaps(out)).toBe(true);
    // Idempotent: re-normalizing reproduces it exactly.
    expect(ys(normalizeDashboardLayout(out))).toEqual(ys(out));
  });
});
