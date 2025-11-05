import { describe, it, expect } from 'vitest';
import { movePanel } from '../move';
import type { GrafanaDashboard } from '@/types/grafana-dashboard';

describe('move', () => {
  const createDashboard = (panels: Array<{ id: number; gridPos: { x: number; y: number; w: number; h: number } }>): GrafanaDashboard => {
    return {
      title: 'Test Dashboard',
      panels: panels.map((p) => ({
        id: p.id,
        title: `Panel ${p.id}`,
        type: 'table' as const,
        gridPos: p.gridPos,
        'x-navixy': {
          sql: { statement: 'SELECT 1' },
          dataset: { shape: 'table', columns: {} },
        },
      })),
    };
  };

  it('should be idempotent: calling movePanel twice with same input yields identical output', () => {
    const dashboard = createDashboard([
      { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
      { id: 2, gridPos: { x: 6, y: 0, w: 4, h: 2 } },
    ]);

    const result1 = movePanel(dashboard, 1, { x: 2, y: 1 });
    const result2 = movePanel(result1, 1, { x: 2, y: 1 });

    expect(result2).toEqual(result1);
  });

  it('should handle ordering determinism: colliders resolved in (y,x,id) order produce stable results', () => {
    const dashboard = createDashboard([
      { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
      { id: 2, gridPos: { x: 2, y: 1, w: 4, h: 2 } },
      { id: 3, gridPos: { x: 4, y: 2, w: 4, h: 2 } },
    ]);

    const result1 = movePanel(dashboard, 1, { x: 0, y: 0 });
    const result2 = movePanel(dashboard, 1, { x: 0, y: 0 });

    // Results should be identical
    expect(result1.panels.map((p) => ({ id: p.id, y: p.gridPos.y }))).toEqual(
      result2.panels.map((p) => ({ id: p.id, y: p.gridPos.y }))
    );
  });

  it('should snap, clamp, resolve collisions, and auto-pack', () => {
    const dashboard = createDashboard([
      { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
      { id: 2, gridPos: { x: 2, y: 1, w: 4, h: 2 } },
      { id: 3, gridPos: { x: 0, y: 5, w: 4, h: 2 } },
    ]);

    // Move panel 1 to overlap with panel 2
    const result = movePanel(dashboard, 1, { x: 2, y: 1 });

    const panel1 = result.panels.find((p) => p.id === 1);
    const panel2 = result.panels.find((p) => p.id === 2);
    const panel3 = result.panels.find((p) => p.id === 3);

    // Panel 1 should be at new position (clamped and snapped)
    expect(panel1!.gridPos.x).toBe(2);
    expect(panel1!.gridPos.y).toBe(1);

    // Panel 2 should be pushed down below panel 1
    expect(panel2!.gridPos.y).toBeGreaterThanOrEqual(panel1!.gridPos.y + panel1!.gridPos.h);

    // Panel 3 should be auto-packed upward
    expect(panel3!.gridPos.y).toBeLessThanOrEqual(5);
  });

  it('should return unchanged dashboard if panel not found', () => {
    const dashboard = createDashboard([
      { id: 1, gridPos: { x: 0, y: 0, w: 4, h: 2 } },
    ]);

    const result = movePanel(dashboard, 999, { x: 5, y: 5 });
    expect(result).toEqual(dashboard);
  });

  it('should preserve unknown fields in dashboard and panels', () => {
    const dashboard: GrafanaDashboard = {
      title: 'Test',
      uid: 'test-uid',
      panels: [
        {
          id: 1,
          title: 'Panel 1',
          type: 'table',
          gridPos: { x: 0, y: 0, w: 4, h: 2 },
          'x-navixy': {
            sql: { statement: 'SELECT 1' },
            dataset: { shape: 'table', columns: {} },
          },
          // @ts-expect-error - testing unknown fields
          customField: 'should be preserved',
        },
      ],
      // @ts-expect-error - testing unknown fields
      customDashboardField: 'should be preserved',
    };

    const result = movePanel(dashboard, 1, { x: 2, y: 1 });

    // @ts-expect-error - testing unknown fields
    expect(result.customDashboardField).toBe('should be preserved');
    // @ts-expect-error - testing unknown fields
    expect(result.panels[0].customField).toBe('should be preserved');
  });
});

