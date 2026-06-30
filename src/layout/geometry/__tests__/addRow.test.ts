import { describe, it, expect } from 'vitest';
import { createRow, canonicalizeRows } from '../rows';
import type { Dashboard, Panel, PanelType } from '@/types/dashboard-types';

// Fully-typed fixtures, matching the sibling geometry tests (no casts needed).
function panel(
  id: string | number,
  type: PanelType,
  pos: { x: number; y: number; w: number; h: number },
  extra: { collapsed?: boolean; panels?: Panel[] } = {}
): Panel {
  return { id, type, title: String(id), gridPos: pos, ...extra };
}

function dash(panels: Panel[]): Dashboard {
  return { title: 'test', time: { from: '', to: '' }, panels };
}

const yById = (d: Dashboard, id: string | number) =>
  d.panels.find((p) => p.id === id)!.gridPos.y;

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

// Mirrors ReportView.handleNewRow: the new row is appended at the bottom of every
// id-bearing panel/row.
const maxY = (d: Dashboard) =>
  Math.max(...d.panels.filter((p) => p.id != null).map((p) => p.gridPos.y + p.gridPos.h));
const addRowAtBottom = (d: Dashboard) => createRow(d, maxY(d), 'New row');

// The healthy "single asset detail" layout (HW Asset Detail Dashboard), exactly as
// stored: 7 plain panels, no rows, content from y=0 to y=56.
const hwAsset = () =>
  dash([
    panel(100, 'text', { x: 0, y: 0, w: 24, h: 3 }),
    panel(1, 'geomap', { x: 0, y: 3, w: 12, h: 12 }),
    panel(2, 'table', { x: 12, y: 3, w: 12, h: 12 }),
    panel(3, 'timeseries', { x: 0, y: 15, w: 24, h: 13 }),
    panel(4, 'barchart', { x: 0, y: 28, w: 12, h: 14 }),
    panel(5, 'table', { x: 12, y: 28, w: 12, h: 14 }),
    panel(6, 'table', { x: 0, y: 42, w: 24, h: 14 }),
  ]);

const CONTENT_IDS = [100, 1, 2, 3, 4, 5, 6] as const;

describe('add row (DO-279 disappearing widgets regression)', () => {
  it('adding a row twice to a row-less dashboard leaves every panel where it was', () => {
    const before = hwAsset();
    const originalY = Object.fromEntries(CONTENT_IDS.map((id) => [id, yById(before, id)]));

    // Add a row, then add a second one — the exact reported repro.
    const afterOne = addRowAtBottom(before);
    const afterTwo = addRowAtBottom(afterOne);

    // No content panel moved a single grid row.
    for (const id of CONTENT_IDS) {
      expect(yById(afterTwo, id)).toBe(originalY[id]);
    }
    // Nothing collapsed on top of anything else.
    expect(hasNoOverlaps(afterTwo)).toBe(true);
    // Two empty rows were appended below the content.
    const rows = afterTwo.panels.filter((p) => p.type === 'row');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.gridPos.y).toBeGreaterThanOrEqual(maxY(before));
    }
  });

  it('keeps spacing widgets correctly even after adding several rows', () => {
    let d = hwAsset();
    const originalY = Object.fromEntries(CONTENT_IDS.map((id) => [id, yById(d, id)]));
    for (let i = 0; i < 5; i++) d = addRowAtBottom(d);

    for (const id of CONTENT_IDS) {
      expect(yById(d, id)).toBe(originalY[id]);
    }
    expect(hasNoOverlaps(d)).toBe(true);
    expect(d.panels.filter((p) => p.type === 'row')).toHaveLength(5);
  });
});

describe('canonicalizeRows / ensureRowSpacing', () => {
  it('pushes a too-close row down without dragging earlier content onto it', () => {
    // Two plain panels above two rows that sit one grid row too close together.
    const out = canonicalizeRows(
      dash([
        panel(1, 'table', { x: 0, y: 0, w: 24, h: 5 }),   // content, top
        panel(2, 'table', { x: 0, y: 5, w: 24, h: 5 }),   // content, below
        panel(10, 'row', { x: 0, y: 10, w: 24, h: 1 }, { collapsed: false }),
        panel(11, 'row', { x: 0, y: 11, w: 24, h: 1 }, { collapsed: false }), // too close
      ])
    );
    // The second row is spaced down to leave a gap; content stays put.
    expect(yById(out, 1)).toBe(0);
    expect(yById(out, 2)).toBe(5);
    expect(yById(out, 10)).toBe(10);
    expect(yById(out, 11)).toBe(12); // pushed from 11 -> prevBottom(11)+1
    expect(hasNoOverlaps(out)).toBe(true);
  });

  it('carries an expanded row\'s band children with it when it is pushed down', () => {
    // row 10 at y=10 owns the child at y=11; row 11 follows immediately. After
    // spacing, the child must move with its header, not be left stranded above it.
    const out = canonicalizeRows(
      dash([
        panel(9, 'row', { x: 0, y: 0, w: 24, h: 1 }, { collapsed: false }),
        panel(8, 'table', { x: 0, y: 1, w: 24, h: 8 }), // band content of row 9
        panel(10, 'row', { x: 0, y: 9, w: 24, h: 1 }, { collapsed: false }), // too close to row 9 content
        panel(11, 'table', { x: 0, y: 10, w: 24, h: 4 }), // band content of row 10
      ])
    );
    expect(hasNoOverlaps(out)).toBe(true);
    // row 10 sits a clear gap below row 9's content (bottom = 9), and its child stays
    // directly under it.
    expect(yById(out, 10)).toBe(10);
    expect(yById(out, 11)).toBe(11);
  });
});
