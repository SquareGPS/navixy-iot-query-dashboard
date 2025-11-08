import { describe, it, expect } from 'vitest';
import { autoPack } from '../autopack';

describe('autopack', () => {
  it('should slide panels upward after move that leaves gaps', () => {
    const panels = [
      { id: 1, gridPos: { x: 0, y: 5, w: 4, h: 2 } },
      { id: 2, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
      { id: 3, gridPos: { x: 0, y: 3, w: 4, h: 2 } },
    ];

    const result = autoPack(panels);

    // Panel 2 should stay at y=0
    const panel2 = result.find((p) => p.id === 2);
    expect(panel2!.gridPos.y).toBe(0);

    // Panel 3 should slide up to y=2 (below panel 2)
    const panel3 = result.find((p) => p.id === 3);
    expect(panel3!.gridPos.y).toBe(2);

    // Panel 1 should slide up to y=4 (below panel 3)
    const panel1 = result.find((p) => p.id === 1);
    expect(panel1!.gridPos.y).toBe(4);
  });

  it('should preserve x, w, h and only modify y', () => {
    const panels = [
      { id: 1, gridPos: { x: 5, y: 10, w: 6, h: 3 } },
      { id: 2, gridPos: { x: 5, y: 0, w: 6, h: 3 } },
    ];

    const result = autoPack(panels);

    const panel1 = result.find((p) => p.id === 1);
    expect(panel1!.gridPos.x).toBe(5);
    expect(panel1!.gridPos.w).toBe(6);
    expect(panel1!.gridPos.h).toBe(3);
    expect(panel1!.gridPos.y).toBe(3); // Below panel 2
  });

  it('should not move panels below y=0', () => {
    const panels = [
      { id: 1, gridPos: { x: 0, y: 10, w: 4, h: 2 } },
    ];

    const result = autoPack(panels);

    const panel1 = result.find((p) => p.id === 1);
    expect(panel1!.gridPos.y).toBeGreaterThanOrEqual(0);
  });

  it('should handle non-overlapping panels correctly', () => {
    const panels = [
      { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
      { id: 2, gridPos: { x: 6, y: 0, w: 4, h: 2 } },
      { id: 3, gridPos: { x: 12, y: 0, w: 4, h: 2 } },
    ];

    const result = autoPack(panels);

    // All panels should stay at y=0 since they don't overlap
    result.forEach((panel) => {
      expect(panel.gridPos.y).toBe(0);
    });
  });

  it('should be deterministic: same input produces same output', () => {
    const panels = [
      { id: 1, gridPos: { x: 0, y: 5, w: 4, h: 2 } },
      { id: 2, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
      { id: 3, gridPos: { x: 0, y: 3, w: 4, h: 2 } },
    ];

    const result1 = autoPack(panels);
    const result2 = autoPack(panels);

    expect(result1).toEqual(result2);
  });
});

