import { describe, it, expect } from 'vitest';
import { repackPanels } from '../repack';

describe('repackPanels', () => {
  it('fills horizontal gap when middle panel is removed', () => {
    const panels = [
      { id: 1, type: 'stat', gridPos: { x: 0, y: 0, w: 6, h: 4 } },
      { id: 3, type: 'stat', gridPos: { x: 12, y: 0, w: 6, h: 4 } },
    ];

    const result = repackPanels(panels);
    const p1 = result.find((p) => p.id === 1)!;
    const p3 = result.find((p) => p.id === 3)!;

    expect(p1.gridPos.x).toBe(0);
    expect(p3.gridPos.x).toBe(12);
    expect(p1.gridPos.y).toBe(p3.gridPos.y);
    expect(p1.gridPos.w + p3.gridPos.w).toBe(24);
  });

  it('removes vertical gap when upper row panels are removed', () => {
    const panels = [{ id: 2, gridPos: { x: 0, y: 20, w: 12, h: 6 } }];

    const result = repackPanels(panels);
    expect(result[0].gridPos.y).toBe(0);
  });

  it('keeps full-width text header above following panels', () => {
    const panels = [
      { id: 'hdr', type: 'text', gridPos: { x: 0, y: 10, w: 24, h: 2 } },
      { id: 1, type: 'stat', gridPos: { x: 0, y: 12, w: 6, h: 4 } },
      { id: 2, type: 'stat', gridPos: { x: 6, y: 12, w: 6, h: 4 } },
    ];

    const result = repackPanels(panels);
    const hdr = result.find((p) => p.id === 'hdr')!;
    const kpi1 = result.find((p) => p.id === 1)!;

    expect(hdr.gridPos.y).toBe(0);
    expect(hdr.gridPos.w).toBe(24);
    expect(kpi1.gridPos.y).toBe(hdr.gridPos.h);
  });
});
