/**
 * Repack dashboard panels using type-aware elegant layout (no gaps, symmetric rows).
 */

import type { GridPos } from './grid';
import {
  layoutPanelsElegantly,
  sortPanelsByPosition,
  type LayoutablePanel,
} from './elegantLayout';

export interface RepackablePanel {
  id: string | number;
  type?: string;
  gridPos: GridPos;
}

/**
 * Re-layout panels on the 24-column grid with elegant placement rules.
 */
export function repackPanels(panels: RepackablePanel[]): RepackablePanel[] {
  if (panels.length === 0) return [];

  const layoutable: LayoutablePanel[] = panels.map((p) => ({
    id: p.id,
    type: p.type ?? 'other',
    gridPos: { ...p.gridPos },
  }));

  const sorted = sortPanelsByPosition(layoutable);
  const placed = layoutPanelsElegantly(sorted);

  return placed.map((p) => ({
    id: p.id,
    gridPos: p.gridPos,
  }));
}
