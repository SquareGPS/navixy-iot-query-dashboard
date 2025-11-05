import { describe, it, expect } from 'vitest';
import { clampToBounds, GRID_COLUMNS } from './grid';

describe('grid', () => {
  describe('clampToBounds', () => {
    it('should clamp right edge: moving a w=10 panel to x=20 clamps to x=14', () => {
      const pos = { x: 20, y: 0, w: 10, h: 1 };
      const clamped = clampToBounds(pos);
      expect(clamped.x).toBe(14); // 24 - 10 = 14
      expect(clamped.w).toBe(10);
      expect(clamped.y).toBe(0);
    });

    it('should clamp x to 0 when negative', () => {
      const pos = { x: -5, y: 10, w: 4, h: 2 };
      const clamped = clampToBounds(pos);
      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(10);
    });

    it('should clamp y to 0 when negative', () => {
      const pos = { x: 5, y: -3, w: 4, h: 2 };
      const clamped = clampToBounds(pos);
      expect(clamped.x).toBe(5);
      expect(clamped.y).toBe(0);
    });

    it('should preserve valid positions', () => {
      const pos = { x: 5, y: 10, w: 4, h: 2 };
      const clamped = clampToBounds(pos);
      expect(clamped.x).toBe(5);
      expect(clamped.y).toBe(10);
      expect(clamped.w).toBe(4);
      expect(clamped.h).toBe(2);
    });

    it('should handle edge case: full width panel at x=0', () => {
      const pos = { x: 0, y: 0, w: 24, h: 1 };
      const clamped = clampToBounds(pos);
      expect(clamped.x).toBe(0);
      expect(clamped.w).toBe(24);
    });

    it('should prevent x+w from exceeding 24', () => {
      const pos = { x: 20, y: 0, w: 10, h: 1 };
      const clamped = clampToBounds(pos);
      expect(clamped.x + clamped.w).toBeLessThanOrEqual(GRID_COLUMNS);
    });
  });
});

