import { describe, it, expect } from '@jest/globals';
import { validateDashboard, RENDERABLE_PANEL_TYPES } from '../validateDashboard.js';

// Table-qualified on purpose: genuinely dotless queries are rejected by the
// guard's parser rescue (O7), which is not what these tests are about.
const GOOD_SQL = 'SELECT d.id, d.label FROM public.devices d ORDER BY d.label';

function makePanel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    type: 'kpi',
    title: 'Panel under test',
    gridPos: { x: 0, y: 0, w: 6, h: 4 },
    'x-navixy': { sql: { statement: GOOD_SQL } },
    ...overrides,
  };
}

function makeSchema(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Test dashboard',
    uid: 'test-dashboard',
    time: { from: 'now-7d', to: 'now' },
    panels: [makePanel()],
    'x-navixy': {},
    ...overrides,
  };
}

const codes = (issues: Array<{ code: string }>): string[] => issues.map((i) => i.code);

describe('validateDashboard', () => {
  it('accepts a fixture-shaped schema with zero errors and zero warnings', () => {
    const result = validateDashboard(makeSchema());
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('exports RENDERABLE_PANEL_TYPES for reuse (MR 2 imports it)', () => {
    expect(RENDERABLE_PANEL_TYPES).toHaveLength(11);
    expect(RENDERABLE_PANEL_TYPES).toEqual(
      expect.arrayContaining(['stat', 'kpi', 'bargauge', 'barchart', 'piechart', 'table',
        'timeseries', 'linechart', 'geomap', 'text', 'row']),
    );
  });

  describe('errors', () => {
    it('NOT_OBJECT: non-objects and arrays are rejected outright', () => {
      for (const bad of [null, undefined, 42, 'dashboard', [makeSchema()]]) {
        const result = validateDashboard(bad);
        expect(codes(result.errors)).toEqual(['NOT_OBJECT']);
      }
    });

    it('MISSING_TITLE: title absent or empty (§V-TITLE: the check is on report_schema.title itself)', () => {
      expect(codes(validateDashboard(makeSchema({ title: undefined })).errors)).toContain('MISSING_TITLE');
      expect(codes(validateDashboard(makeSchema({ title: '   ' })).errors)).toContain('MISSING_TITLE');
    });

    it('§V-TITLE: a schema with its own title and no separate top-level result title has zero errors', () => {
      // There is no separate result.title field on the wire from the agent;
      // nothing here may require one.
      const result = validateDashboard(makeSchema());
      expect(result.errors).toEqual([]);
    });

    it('MISSING_PANELS: panels absent or empty', () => {
      expect(codes(validateDashboard(makeSchema({ panels: undefined })).errors)).toContain('MISSING_PANELS');
      expect(codes(validateDashboard(makeSchema({ panels: [] })).errors)).toContain('MISSING_PANELS');
    });

    it('MISSING_TIME: time.from / time.to must be strings', () => {
      expect(codes(validateDashboard(makeSchema({ time: undefined })).errors)).toContain('MISSING_TIME');
      expect(codes(validateDashboard(makeSchema({ time: { from: 'now-7d' } })).errors)).toContain('MISSING_TIME');
    });

    it('UNKNOWN_PANEL_TYPE: types outside the live dispatch are errors', () => {
      const result = validateDashboard(makeSchema({ panels: [makePanel({ type: 'gauge' })] }));
      expect(codes(result.errors)).toContain('UNKNOWN_PANEL_TYPE');
    });

    it('MISSING_PANEL_ID: the renderer keys per-panel state by String(panel.id)', () => {
      const result = validateDashboard(makeSchema({ panels: [makePanel({ id: undefined })] }));
      expect(codes(result.errors)).toContain('MISSING_PANEL_ID');
    });

    it('DUPLICATE_PANEL_ID: ids must be unique across top-level panels', () => {
      const result = validateDashboard(makeSchema({
        panels: [
          makePanel({ id: 1 }),
          makePanel({ id: 1, gridPos: { x: 6, y: 0, w: 6, h: 4 } }),
        ],
      }));
      expect(codes(result.errors)).toContain('DUPLICATE_PANEL_ID');
    });

    it('DUPLICATE_PANEL_ID: row children participate in uniqueness', () => {
      const result = validateDashboard(makeSchema({
        panels: [
          makePanel({ id: 7 }),
          {
            id: 8,
            type: 'row',
            title: 'Section',
            gridPos: { x: 0, y: 4, w: 24, h: 1 },
            panels: [{ id: 7, type: 'kpi' }],
          },
        ],
      }));
      expect(codes(result.errors)).toContain('DUPLICATE_PANEL_ID');
    });

    it('BAD_GRIDPOS: missing, non-integer, w<1, h<1 or x<0', () => {
      for (const gridPos of [
        undefined,
        { x: 0, y: 0, w: 0, h: 4 },
        { x: 0, y: 0, w: 6, h: 0 },
        { x: -1, y: 0, w: 6, h: 4 },
        { x: 0.5, y: 0, w: 6, h: 4 },
        { x: 0, y: 0, w: 6 },
      ]) {
        const result = validateDashboard(makeSchema({ panels: [makePanel({ gridPos })] }));
        expect(codes(result.errors)).toContain('BAD_GRIDPOS');
      }
    });

    it('GRIDPOS_OVERFLOW: {x:20,w:8} exceeds the 24-column grid', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ gridPos: { x: 20, y: 0, w: 8, h: 4 } })],
      }));
      expect(codes(result.errors)).toContain('GRIDPOS_OVERFLOW');
    });

    it('MISSING_SQL: an empty statement produces exactly MISSING_SQL', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': { sql: { statement: '' } } })],
      }));
      expect(codes(result.errors)).toEqual(['MISSING_SQL']);
    });

    it('MISSING_SQL: a non-text/row panel with no x-navixy at all', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': undefined })],
      }));
      expect(codes(result.errors)).toEqual(['MISSING_SQL']);
    });

    it('SQL_REJECTED: the guard rejects blocked bare words (SELECT version FROM devices)', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': { sql: { statement: 'SELECT version FROM devices' } } })],
      }));
      expect(codes(result.errors)).toContain('SQL_REJECTED');
    });

    it('LIMIT_PLACEHOLDER: LIMIT ${var} breaks at bind time', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': { sql: { statement: 'SELECT a FROM t LIMIT ${n}' } } })],
      }));
      expect(codes(result.errors)).toContain('LIMIT_PLACEHOLDER');
    });

    it('TRAILING_COMMENT: a -- comment on the last non-blank line', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': { sql: { statement: `${GOOD_SQL} -- cap lands in here` } } })],
      }));
      expect(codes(result.errors)).toContain('TRAILING_COMMENT');
    });

    it('TRAILING_COMMENT: -- inside a quoted literal on the last line does not fire', () => {
      const statement = "SELECT d.id FROM public.devices d WHERE d.note = 'a--b'";
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': { sql: { statement } } })],
      }));
      expect(codes(result.errors)).not.toContain('TRAILING_COMMENT');
    });
  });

  describe('warnings — never block', () => {
    it('MISSING_NAVIXY_EXT: no top-level x-navixy is zero errors, one warning (fixture 01 ships this way — C1)', () => {
      const result = validateDashboard(makeSchema({ 'x-navixy': undefined }));
      expect(result.errors).toEqual([]);
      expect(codes(result.warnings)).toEqual(['MISSING_NAVIXY_EXT']);
    });

    it('PANEL_OVERLAP: two overlapping panels are zero errors, one warning (fixture 12 overlaps and renders — C1)', () => {
      const result = validateDashboard(makeSchema({
        panels: [
          makePanel({ id: 1, gridPos: { x: 0, y: 0, w: 12, h: 4 } }),
          makePanel({ id: 2, gridPos: { x: 6, y: 2, w: 12, h: 4 } }),
        ],
      }));
      expect(result.errors).toEqual([]);
      expect(codes(result.warnings)).toEqual(['PANEL_OVERLAP']);
    });

    it('GEOMAP_NO_COORD_ALIAS: geomap SQL with no lat/lon token warns, never errors', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ type: 'geomap' })],
      }));
      expect(result.errors).toEqual([]);
      expect(codes(result.warnings)).toEqual(['GEOMAP_NO_COORD_ALIAS']);
    });

    it('GEOMAP_NO_COORD_ALIAS: projecting lat/lon silences the warning', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({
          type: 'geomap',
          'x-navixy': { sql: { statement: 'SELECT t.lat, t.lon FROM public.positions t' } },
        })],
      }));
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('rules the dead frontend validator gets wrong (C1)', () => {
    it('text and row panels validate with no x-navixy at all', () => {
      const result = validateDashboard(makeSchema({
        panels: [
          { id: 1, type: 'row', title: 'Section', gridPos: { x: 0, y: 0, w: 24, h: 1 } },
          { id: 2, type: 'text', title: 'Note', gridPos: { x: 0, y: 1, w: 12, h: 3 }, options: { mode: 'markdown', content: 'hello' } },
        ],
      }));
      expect(result.errors).toEqual([]);
    });

    it('absence of :param syntax is not flagged at all (the binder uses ${var}, not :param)', () => {
      const result = validateDashboard(makeSchema());
      const all = [...result.errors, ...result.warnings];
      expect(all).toEqual([]);
      expect(GOOD_SQL).not.toContain(':');
    });
  });
});
