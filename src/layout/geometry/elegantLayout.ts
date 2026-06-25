/**
 * Type-aware dashboard layout for Tidy Up and repack flows.
 *
 * Rules (24-column Grafana grid):
 * - Indicators (kpi, stat): balanced rows, max 5 per row, equal widths
 * - Bar charts (barchart, bargauge): max 2 per row; a lone chart spans full width
 * - Maps & tables: one per row, full width
 * - Other charts: max 2 per row; lone chart spans full width
 * - Text: full width
 */

import type { GridPos } from './grid';
import { GRID_COLUMNS } from './grid';
import { DEFAULT_SIZE_BY_TYPE } from './add';
import { naturalIdCompare } from './idUtils';

export interface LayoutablePanel {
  id: string | number;
  type: string;
  gridPos: GridPos;
}

export type LayoutBucket =
  | 'indicator'
  | 'bar'
  | 'chart'
  | 'map'
  | 'table'
  | 'text'
  | 'other';

const INDICATOR_TYPES = new Set(['kpi', 'stat']);
const BAR_TYPES = new Set(['barchart', 'bargauge']);
const CHART_TYPES = new Set(['piechart', 'timeseries', 'linechart']);
const MAP_TYPES = new Set(['geomap']);
const TABLE_TYPES = new Set(['table']);
const TEXT_TYPES = new Set(['text']);

export function getLayoutBucket(type: string): LayoutBucket {
  if (INDICATOR_TYPES.has(type)) return 'indicator';
  if (BAR_TYPES.has(type)) return 'bar';
  if (CHART_TYPES.has(type)) return 'chart';
  if (MAP_TYPES.has(type)) return 'map';
  if (TABLE_TYPES.has(type)) return 'table';
  if (TEXT_TYPES.has(type)) return 'text';
  return 'other';
}

/** Panel sort order: top-to-bottom, left-to-right, stable id. */
export function sortPanelsByPosition<T extends LayoutablePanel>(panels: T[]): T[] {
  return [...panels].sort((a, b) => {
    if (a.gridPos.y !== b.gridPos.y) return a.gridPos.y - b.gridPos.y;
    if (a.gridPos.x !== b.gridPos.x) return a.gridPos.x - b.gridPos.x;
    return naturalIdCompare(a.id, b.id);
  });
}

/**
 * Split counts across rows as evenly as possible, capped at maxPerRow.
 * e.g. 7 → [4, 3], 6 → [3, 3], 9 → [5, 4], 11 → [4, 4, 3].
 */
export function balancedRowSizes(count: number, maxPerRow: number): number[] {
  if (count <= 0) return [];
  const numRows = Math.ceil(count / maxPerRow);
  const sizes: number[] = [];
  let remaining = count;

  for (let r = 0; r < numRows; r++) {
    const rowsLeft = numRows - r;
    const size = Math.min(maxPerRow, Math.ceil(remaining / rowsLeft));
    sizes.push(size);
    remaining -= size;
  }

  return sizes;
}

/** Distribute 24 columns across n panels (integer widths, full row). */
export function distributeWidths(count: number, totalCols = GRID_COLUMNS): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalCols / count);
  let remainder = totalCols - base * count;
  return Array.from({ length: count }, (_, i) => {
    const extra = i < remainder ? 1 : 0;
    return base + extra;
  });
}

function defaultPanelHeight(type: string): number {
  return DEFAULT_SIZE_BY_TYPE[type]?.h ?? 6;
}

function panelHeight(panel: LayoutablePanel): number {
  const h = panel.gridPos.h;
  if (h > 0) return h;
  return defaultPanelHeight(panel.type);
}

function bucketHeight(panels: LayoutablePanel[]): number {
  if (panels.length === 0) return 0;
  return Math.max(...panels.map(panelHeight));
}

const BUCKET_STACK_ORDER: LayoutBucket[] = [
  'text',
  'indicator',
  'bar',
  'chart',
  'map',
  'table',
  'other',
];

function groupByBucketOrder(panels: LayoutablePanel[]): {
  order: LayoutBucket[];
  groups: Map<LayoutBucket, LayoutablePanel[]>;
} {
  const sorted = sortPanelsByPosition(panels);
  const groups = new Map<LayoutBucket, LayoutablePanel[]>();

  for (const panel of sorted) {
    const bucket = getLayoutBucket(panel.type);
    if (!groups.has(bucket)) {
      groups.set(bucket, []);
    }
    groups.get(bucket)!.push(panel);
  }

  const order = BUCKET_STACK_ORDER.filter((b) => groups.has(b));
  return { order, groups };
}

function placeRow(
  panels: LayoutablePanel[],
  y: number,
  widths: number[],
  h: number
): LayoutablePanel[] {
  let x = 0;
  return panels.map((panel, i) => {
    const w = widths[i];
    const placed = {
      ...panel,
      gridPos: { x, y, w, h },
    };
    x += w;
    return placed;
  });
}

function layoutIndicatorBucket(panels: LayoutablePanel[], startY: number): LayoutablePanel[] {
  const rowSizes = balancedRowSizes(panels.length, 5);
  const h = bucketHeight(panels);
  const result: LayoutablePanel[] = [];
  let idx = 0;
  let y = startY;

  for (const rowCount of rowSizes) {
    const rowPanels = panels.slice(idx, idx + rowCount);
    const widths = distributeWidths(rowCount);
    result.push(...placeRow(rowPanels, y, widths, h));
    idx += rowCount;
    y += h;
  }

  return result;
}

function layoutPairBucket(panels: LayoutablePanel[], startY: number): LayoutablePanel[] {
  const result: LayoutablePanel[] = [];
  let y = startY;
  let i = 0;

  while (i < panels.length) {
    const remaining = panels.length - i;
    if (remaining === 1) {
      const panel = panels[i];
      const h = panelHeight(panel);
      result.push({
        ...panel,
        gridPos: { x: 0, y, w: GRID_COLUMNS, h },
      });
      y += h;
      i += 1;
    } else {
      const left = panels[i];
      const right = panels[i + 1];
      const h = Math.max(panelHeight(left), panelHeight(right));
      result.push(
        { ...left, gridPos: { x: 0, y, w: 12, h } },
        { ...right, gridPos: { x: 12, y, w: 12, h } }
      );
      y += h;
      i += 2;
    }
  }

  return result;
}

function layoutFullWidthBucket(panels: LayoutablePanel[], startY: number): LayoutablePanel[] {
  let y = startY;
  const result: LayoutablePanel[] = [];

  for (const panel of panels) {
    const h = panelHeight(panel);
    result.push({
      ...panel,
      gridPos: { x: 0, y, w: GRID_COLUMNS, h },
    });
    y += h;
  }

  return result;
}

function layoutBucket(
  bucket: LayoutBucket,
  panels: LayoutablePanel[],
  startY: number
): LayoutablePanel[] {
  switch (bucket) {
    case 'indicator':
      return layoutIndicatorBucket(panels, startY);
    case 'bar':
    case 'chart':
    case 'other':
      return layoutPairBucket(panels, startY);
    case 'map':
    case 'table':
    case 'text':
      return layoutFullWidthBucket(panels, startY);
    default:
      return layoutPairBucket(panels, startY);
  }
}

export function sectionBottomY(panels: LayoutablePanel[]): number {
  if (panels.length === 0) return 0;
  return Math.max(...panels.map((p) => p.gridPos.y + p.gridPos.h));
}

/**
 * Re-layout panels from y=0 using type-aware placement rules.
 */
export function layoutPanelsElegantly(panels: LayoutablePanel[]): LayoutablePanel[] {
  if (panels.length === 0) return [];

  const { order, groups } = groupByBucketOrder(panels);
  let y = 0;
  const result: LayoutablePanel[] = [];

  for (const bucket of order) {
    const bucketPanels = groups.get(bucket)!;
    const placed = layoutBucket(bucket, bucketPanels, y);
    result.push(...placed);
    y = sectionBottomY(placed);
  }

  return result;
}
