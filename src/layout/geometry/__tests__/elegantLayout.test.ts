import { describe, it, expect } from 'vitest';
import {
  balancedRowSizes,
  distributeWidths,
  layoutPanelsElegantly,
  getLayoutBucket,
} from '../elegantLayout';

describe('balancedRowSizes', () => {
  it('puts 7 indicators as 4+3', () => {
    expect(balancedRowSizes(7, 5)).toEqual([4, 3]);
  });

  it('puts 6 indicators as 3+3', () => {
    expect(balancedRowSizes(6, 5)).toEqual([3, 3]);
  });

  it('keeps 5 on one row', () => {
    expect(balancedRowSizes(5, 5)).toEqual([5]);
  });
});

describe('distributeWidths', () => {
  it('splits 24 across 3 panels', () => {
    expect(distributeWidths(3)).toEqual([8, 8, 8]);
  });

  it('splits 24 across 5 panels', () => {
    expect(distributeWidths(5)).toEqual([5, 5, 5, 5, 4]);
  });
});

describe('layoutPanelsElegantly', () => {
  const kpi = (id: number) => ({
    id,
    type: 'stat',
    gridPos: { x: 0, y: 99, w: 6, h: 5 },
  });

  it('lays out 7 KPIs as two symmetric rows', () => {
    const panels = Array.from({ length: 7 }, (_, i) => kpi(i + 1));
    const result = layoutPanelsElegantly(panels);

    const row0 = result.filter((p) => p.gridPos.y === 0);
    const row1 = result.filter((p) => p.gridPos.y === 5);

    expect(row0.length).toBe(4);
    expect(row1.length).toBe(3);
    expect(row0.reduce((s, p) => s + p.gridPos.w, 0)).toBe(24);
    expect(row1.reduce((s, p) => s + p.gridPos.w, 0)).toBe(24);
    expect(result.every((p) => p.gridPos.x >= 0 && p.gridPos.x + p.gridPos.w <= 24)).toBe(true);
  });

  it('places single bar chart full width', () => {
    const result = layoutPanelsElegantly([
      { id: 1, type: 'barchart', gridPos: { x: 6, y: 10, w: 8, h: 8 } },
    ]);
    expect(result[0].gridPos).toMatchObject({ x: 0, y: 0, w: 24, h: 8 });
  });

  it('places two bar charts side by side', () => {
    const result = layoutPanelsElegantly([
      { id: 1, type: 'barchart', gridPos: { x: 0, y: 0, w: 24, h: 8 } },
      { id: 2, type: 'barchart', gridPos: { x: 0, y: 8, w: 24, h: 8 } },
    ]);
    expect(result[0].gridPos).toMatchObject({ x: 0, w: 12 });
    expect(result[1].gridPos).toMatchObject({ x: 12, w: 12 });
    expect(result[0].gridPos.y).toBe(result[1].gridPos.y);
  });

  it('places table full width one per row', () => {
    const result = layoutPanelsElegantly([
      { id: 1, type: 'table', gridPos: { x: 0, y: 0, w: 12, h: 8 } },
      { id: 2, type: 'table', gridPos: { x: 12, y: 0, w: 12, h: 10 } },
    ]);
    expect(result[0].gridPos).toMatchObject({ x: 0, w: 24, y: 0, h: 8 });
    expect(result[1].gridPos).toMatchObject({ x: 0, w: 24, y: 8, h: 10 });
  });

  it('stacks buckets: indicators then bar charts', () => {
    const result = layoutPanelsElegantly([
      { id: 'b', type: 'barchart', gridPos: { x: 0, y: 0, w: 12, h: 8 } },
      { id: 'k', type: 'stat', gridPos: { x: 0, y: 8, w: 6, h: 5 } },
    ]);
    const stat = result.find((p) => p.id === 'k')!;
    const bar = result.find((p) => p.id === 'b')!;
    expect(stat.gridPos.y).toBe(0);
    expect(bar.gridPos.y).toBe(5);
  });
});

describe('getLayoutBucket', () => {
  it('classifies panel types', () => {
    expect(getLayoutBucket('stat')).toBe('indicator');
    expect(getLayoutBucket('barchart')).toBe('bar');
    expect(getLayoutBucket('geomap')).toBe('map');
    expect(getLayoutBucket('table')).toBe('table');
  });
});
