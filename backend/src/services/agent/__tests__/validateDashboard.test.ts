import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

    it('MISSING_SQL: a non-string statement is an error (no SQL config is malformed output, not a placeholder)', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': { sql: { statement: 42 } } })],
      }));
      expect(codes(result.errors)).toEqual(['MISSING_SQL']);
    });

    it('UNKNOWN_PANEL_TYPE: a null panel entry is reported, never thrown on', () => {
      const result = validateDashboard(makeSchema({ panels: [null, makePanel()] }));
      expect(codes(result.errors)).toEqual(['UNKNOWN_PANEL_TYPE']);
    });

    it('UNKNOWN_PANEL_TYPE: a panel with no type at all', () => {
      const result = validateDashboard(makeSchema({ panels: [makePanel({ type: undefined })] }));
      expect(codes(result.errors)).toContain('UNKNOWN_PANEL_TYPE');
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

    it('TRAILING_COMMENT: a multi-line literal whose last line starts with -- is not a comment', () => {
      const statement = "SELECT d.id, 'note:\n-- not a comment' AS note FROM public.devices d";
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': { sql: { statement } } })],
      }));
      expect(codes(result.errors)).not.toContain('TRAILING_COMMENT');
    });

    it('TRAILING_COMMENT: an apostrophe inside an earlier-line comment does not mask a real trailing comment', () => {
      const statement = "SELECT d.id -- don't let this apostrophe leak\nFROM public.devices d -- cap lands here";
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': { sql: { statement } } })],
      }));
      expect(codes(result.errors)).toContain('TRAILING_COMMENT');
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

    it('PANEL_OVERLAP: edge-adjacent panels never warn (real dashboards are wall-to-wall adjacencies)', () => {
      const result = validateDashboard(makeSchema({
        panels: [
          makePanel({ id: 1, gridPos: { x: 0, y: 0, w: 12, h: 4 } }),
          makePanel({ id: 2, gridPos: { x: 12, y: 0, w: 12, h: 4 } }),
          makePanel({ id: 3, gridPos: { x: 0, y: 4, w: 24, h: 4 } }),
        ],
      }));
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('EMPTY_SQL: an empty statement is a warning, not an error (fixture 05 ships such a placeholder)', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': { sql: { statement: '' } } })],
      }));
      expect(result.errors).toEqual([]);
      expect(codes(result.warnings)).toEqual(['EMPTY_SQL']);
    });

    it('EMPTY_SQL: whitespace-only statements count as empty', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel({ 'x-navixy': { sql: { statement: '   \n  ' } } })],
      }));
      expect(result.errors).toEqual([]);
      expect(codes(result.warnings)).toEqual(['EMPTY_SQL']);
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

  describe('row children are validated recursively', () => {
    function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        id: 100,
        type: 'row',
        title: 'Section',
        gridPos: { x: 0, y: 8, w: 24, h: 1 },
        ...overrides,
      };
    }
    const child = (overrides: Record<string, unknown> = {}): Record<string, unknown> =>
      makePanel({ id: 101, gridPos: { x: 0, y: 9, w: 12, h: 4 }, ...overrides });

    it('a row with well-formed children has zero errors', () => {
      const result = validateDashboard(makeSchema({
        panels: [makePanel(), makeRow({ panels: [child(), child({ id: 102, gridPos: { x: 12, y: 9, w: 12, h: 4 } })] })],
      }));
      expect(result.errors).toEqual([]);
    });

    it('a malformed child is reported instead of crashing row expansion later', () => {
      const result = validateDashboard(makeSchema({
        panels: [makeRow({ panels: [child({ gridPos: undefined }), null] })],
      }));
      expect(codes(result.errors)).toContain('BAD_GRIDPOS');
      expect(codes(result.errors)).toContain('UNKNOWN_PANEL_TYPE');
      const gridIssue = result.errors.find((i) => i.code === 'BAD_GRIDPOS');
      expect(gridIssue?.path).toBe('panels[0].panels[0].gridPos');
    });

    it('a child with no id is an error (expansion promotes it to a real panel)', () => {
      const result = validateDashboard(makeSchema({
        panels: [makeRow({ panels: [child({ id: undefined })] })],
      }));
      expect(codes(result.errors)).toContain('MISSING_PANEL_ID');
    });

    it('a child data panel is held to the SQL rules (DELETE cannot hide inside a row)', () => {
      const result = validateDashboard(makeSchema({
        panels: [makeRow({ panels: [child({ 'x-navixy': { sql: { statement: 'DELETE FROM public.devices' } } })] })],
      }));
      expect(codes(result.errors)).toContain('SQL_REJECTED');
    });

    it('NESTED_ROW: a row inside a row is an error, never descended into', () => {
      const result = validateDashboard(makeSchema({
        panels: [makeRow({ panels: [makeRow({ id: 101, panels: [child({ id: 102 })] })] })],
      }));
      expect(codes(result.errors)).toContain('NESTED_ROW');
    });

    it('BAD_ROW_PANELS: a non-array `panels` on a row is an error', () => {
      const result = validateDashboard(makeSchema({
        panels: [makeRow({ panels: 'not-an-array' })],
      }));
      expect(codes(result.errors)).toContain('BAD_ROW_PANELS');
    });

    it('SQL carried BY a row or text panel is validated when present (the renderer submits it)', () => {
      for (const type of ['row', 'text']) {
        const result = validateDashboard(makeSchema({
          panels: [makePanel({ type, 'x-navixy': { sql: { statement: 'DELETE FROM public.devices' } } })],
        }));
        expect(codes(result.errors)).toContain('SQL_REJECTED');
      }
    });

    it('a row carrying a valid SELECT, an empty statement or no SQL at all stays clean', () => {
      for (const nav of [
        { sql: { statement: GOOD_SQL } },
        { sql: { statement: '' } },
        undefined,
      ]) {
        const result = validateDashboard(makeSchema({
          panels: [makePanel(), makeRow({ 'x-navixy': nav })],
        }));
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
      }
    });

    it('children are excluded from the overlap heuristic (their gridPos is post-expansion)', () => {
      // Child rect would "overlap" the top-level panel if compared naively.
      const result = validateDashboard(makeSchema({
        panels: [makePanel(), makeRow({ panels: [child({ gridPos: { x: 0, y: 0, w: 6, h: 4 } })] })],
      }));
      expect(result.warnings).toEqual([]);
    });
  });

  describe('calibration against the shipped fixtures', () => {
    // The design invariant behind the whole error/warning boundary: a
    // dashboard the app ships today must never be rewritten to type:'error'.
    // Warnings are expected (overlaps in 02/10/11/12/13, missing x-navixy in
    // 01, an empty placeholder statement in 05) and deliberately unasserted
    // here — pinning them per fixture is the corpus test's job (MR 2).
    it('all 14 schemas/*.json produce zero errors', () => {
      const dir = fileURLToPath(new URL('../../../../../schemas/', import.meta.url));
      const files = readdirSync(dir).filter((f) => f.endsWith('-schema.json')).sort();
      expect(files).toHaveLength(14);
      for (const file of files) {
        const schema = JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown;
        const result = validateDashboard(schema);
        expect({ file, errors: result.errors }).toEqual({ file, errors: [] });
      }
    });
  });
});
