import { describe, it, expect, beforeEach } from 'vitest';
import { cmdAddPanel, cmdAddPresetPanel, getPresetSize } from '../commands';
import { useEditorStore } from '../editorStore';
import type { Panel } from '@/types/dashboard-types';
import type { ChartPresetPanel } from '@/types/chart-catalog';

function loadDashboard(panels: Panel[]): void {
  const store = useEditorStore.getState();
  store.reset();
  store.setDashboard({ title: 'test', time: { from: '', to: '' }, panels });
}

const panels = () => useEditorStore.getState().dashboard!.panels;

// DO-317: a newly created panel must never start below its type's MIN_BY_TYPE.
// These pin that at the command layer for the two size-carrying add paths — the
// "Add Panel" gallery (cmdAddPanel) and the Chart Library drop (cmdAddPresetPanel)
// — and check the preset drag ghost is sized from the same clamped footprint, so
// the preview never diverges from the committed panel.
describe('a newly created panel respects its minimum size (DO-317)', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('cmdAddPanel bumps a Small table (6x4) up to the 12x8 table minimum', () => {
    loadDashboard([]);
    cmdAddPanel({ type: 'table', size: { w: 6, h: 4 }, target: 'top', hint: { position: { x: 0, y: 0 } } });
    const created = panels().find((p) => p.type === 'table')!;
    expect(created.gridPos).toMatchObject({ w: 12, h: 8 });
  });

  it('cmdAddPanel raises a Small bar chart height to its 6-row minimum', () => {
    loadDashboard([]);
    cmdAddPanel({ type: 'barchart', size: { w: 6, h: 4 }, target: 'top', hint: { position: { x: 0, y: 0 } } });
    const created = panels().find((p) => p.type === 'barchart')!;
    expect(created.gridPos).toMatchObject({ w: 6, h: 6 });
  });

  it('cmdAddPresetPanel clamps a below-minimum catalog preset to its floor', () => {
    loadDashboard([]);
    const preset = { type: 'table', title: 'Saved table', gridPos: { w: 6, h: 4 } } as ChartPresetPanel;
    cmdAddPresetPanel(preset, { x: 0, y: 0 });
    const created = panels().find((p) => p.type === 'table')!;
    expect(created.gridPos).toMatchObject({ w: 12, h: 8 });
  });

  it('getPresetSize returns the clamped footprint, so the drag ghost matches the created panel', () => {
    const preset = { type: 'table', title: 't', gridPos: { w: 6, h: 4 } } as ChartPresetPanel;
    expect(getPresetSize(preset)).toEqual({ w: 12, h: 8 });
  });
});
