import { describe, it, expect } from 'vitest';
import { rectOverlap, anyOverlap, resolveCollisionsPushDown } from '../collisions';

describe('collisions', () => {
  describe('rectOverlap', () => {
    it('should detect overlapping rectangles', () => {
      const a = { x: 0, y: 0, w: 4, h: 2 };
      const b = { x: 2, y: 1, w: 4, h: 2 };
      expect(rectOverlap(a, b)).toBe(true);
    });

    it('should detect non-overlapping rectangles', () => {
      const a = { x: 0, y: 0, w: 4, h: 2 };
      const b = { x: 5, y: 0, w: 4, h: 2 };
      expect(rectOverlap(a, b)).toBe(false);
    });

    it('should detect touching rectangles as overlapping', () => {
      const a = { x: 0, y: 0, w: 4, h: 2 };
      const b = { x: 4, y: 0, w: 4, h: 2 };
      expect(rectOverlap(a, b)).toBe(false); // Touching at edge, not overlapping
    });

    it('should handle vertical overlap', () => {
      const a = { x: 0, y: 0, w: 4, h: 4 };
      const b = { x: 0, y: 2, w: 4, h: 4 };
      expect(rectOverlap(a, b)).toBe(true);
    });
  });

  describe('anyOverlap', () => {
    it('should detect overlap with any panel', () => {
      const rect = { x: 2, y: 1, w: 4, h: 2 };
      const panels = [
        { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
        { id: 2, gridPos: { x: 6, y: 0, w: 4, h: 2 } },
        { id: 3, gridPos: { x: 4, y: 3, w: 4, h: 2 } },
      ];
      expect(anyOverlap(rect, panels)).toBe(true);
    });

    it('should exclude specified panel id', () => {
      const rect = { x: 0, y: 0, w: 4, h: 2 };
      const panels = [
        { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
        { id: 2, gridPos: { x: 6, y: 0, w: 4, h: 2 } },
      ];
      expect(anyOverlap(rect, panels, 1)).toBe(false);
    });

    it('should return false when no overlaps', () => {
      const rect = { x: 10, y: 10, w: 4, h: 2 };
      const panels = [
        { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
        { id: 2, gridPos: { x: 6, y: 0, w: 4, h: 2 } },
      ];
      expect(anyOverlap(rect, panels)).toBe(false);
    });
  });

  describe('resolveCollisionsPushDown', () => {
    it('should resolve single collision: move A onto B → B pushed to A.y + A.h', () => {
      const moved = { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } };
      const panels = [
        { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
        { id: 2, gridPos: { x: 2, y: 1, w: 4, h: 2 } },
      ];

      const result = resolveCollisionsPushDown(moved, panels);

      const panel2 = result.find((p) => p.id === 2);
      expect(panel2).toBeDefined();
      expect(panel2!.gridPos.y).toBe(2); // A.y + A.h = 0 + 2 = 2
      expect(panel2!.gridPos.x).toBe(2); // x preserved
    });

    it('should resolve cascade: A overlaps B, B overlaps C → B pushed below A, C pushed below B', () => {
      const moved = { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } };
      const panels = [
        { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
        { id: 2, gridPos: { x: 2, y: 1, w: 4, h: 2 } },
        { id: 3, gridPos: { x: 4, y: 2, w: 4, h: 2 } },
      ];

      const result = resolveCollisionsPushDown(moved, panels);

      const panel2 = result.find((p) => p.id === 2);
      const panel3 = result.find((p) => p.id === 3);

      expect(panel2!.gridPos.y).toBe(2); // Below A
      expect(panel3!.gridPos.y).toBe(4); // Below B (2 + 2)
    });

    it('should be deterministic: same input produces same output', () => {
      const moved = { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } };
      const panels = [
        { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
        { id: 2, gridPos: { x: 2, y: 1, w: 4, h: 2 } },
        { id: 3, gridPos: { x: 4, y: 2, w: 4, h: 2 } },
      ];

      const result1 = resolveCollisionsPushDown(moved, panels);
      const result2 = resolveCollisionsPushDown(moved, panels);

      expect(result1).toEqual(result2);
    });

    it('should preserve non-overlapping panels', () => {
      const moved = { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } };
      const panels = [
        { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
        { id: 2, gridPos: { x: 10, y: 10, w: 4, h: 2 } },
      ];

      const result = resolveCollisionsPushDown(moved, panels);

      const panel2 = result.find((p) => p.id === 2);
      expect(panel2!.gridPos.y).toBe(10);
      expect(panel2!.gridPos.x).toBe(10);
    });
  });
});

