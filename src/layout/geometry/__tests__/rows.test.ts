import { describe, it, expect } from 'vitest';
import { toggleRowCollapsed } from '../rows';
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

describe('toggleRowCollapsed round-trip (DO-313 validator calibration)', () => {
  it('collapse stores non-negative relative y and expand restores absolute y', () => {
    // Band children always sit at or below bandTop (rowY + 1), so collapse can
    // only ever store relative y >= 0. This is the invariant that makes a
    // NEGATIVE stored child y impossible to produce through the app — it can
    // only arrive in foreign JSON, which backend validateDashboard rejects
    // via BAD_GRIDPOS (y >= 0).
    const before = dash([
      panel(10, 'row', { x: 0, y: 0, w: 24, h: 1 }, { collapsed: false }),
      panel(1, 'table', { x: 0, y: 1, w: 24, h: 4 }),
      panel(2, 'table', { x: 0, y: 5, w: 24, h: 2 }),
    ]);

    const collapsed = toggleRowCollapsed(before, 10, true);
    const row = collapsed.panels.find((p) => p.id === 10)!;
    expect(collapsed.panels.map((p) => p.id)).toEqual([10]);
    expect(row.panels!.map((p) => ({ id: p.id, y: p.gridPos.y }))).toEqual([
      { id: 1, y: 0 },
      { id: 2, y: 4 },
    ]);
    for (const child of row.panels!) {
      expect(child.gridPos.y).toBeGreaterThanOrEqual(0);
    }

    const expanded = toggleRowCollapsed(collapsed, 10, false);
    expect(yById(expanded, 1)).toBe(1);
    expect(yById(expanded, 2)).toBe(5);
  });

  it('expansion trusts a stored negative child y and lands the panel off-canvas', () => {
    // The reviewer-demonstrated failure (MR !55 round 3): a collapsed child
    // with gridPos.y = -10 under a row at y = 0 is promoted to absolute
    // y = bandTop + (-10) = -9 — above the canvas, invisible, unrecoverable
    // in the editor. toggleRowCollapsed does NOT clamp; the backend gate
    // (validateDashboard BAD_GRIDPOS, y >= 0) is what keeps this shape out.
    // If clamping is ever added here, this pin fails — revisit the gate note.
    const stored = dash([
      panel(10, 'row', { x: 0, y: 0, w: 24, h: 1 }, {
        collapsed: true,
        panels: [panel(1, 'table', { x: 0, y: -10, w: 24, h: 4 })],
      }),
    ]);

    const expanded = toggleRowCollapsed(stored, 10, false);
    expect(yById(expanded, 1)).toBe(-9);
    expect(yById(expanded, 1)).toBeLessThan(0);
  });
});
