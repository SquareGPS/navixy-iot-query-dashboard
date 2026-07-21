import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_CORPUS, DEFAULT_CORPUS_ID, type CorpusEntry } from '../corpus.generated.js';
import { validateDashboard, RENDERABLE_PANEL_TYPES } from '../validateDashboard.js';
import { validateSQLQuerySafe } from '../../../utils/sqlValidationIntegration.js';

const SCHEMAS_DIR = fileURLToPath(new URL('../../../../../schemas/', import.meta.url));
const GENERATOR_URL = new URL('../../../../scripts/build-agent-corpus.mjs', import.meta.url).href;

interface DropNote {
  source: string;
  panelId: number;
  reason: string;
}

interface GeneratorModule {
  loadFixtures(dir: string): Record<string, unknown>;
  buildCorpus(fixtures: Record<string, unknown>, notes?: DropNote[]): CorpusEntry[];
  renderModule(corpus: CorpusEntry[], notes: DropNote[]): string;
  statementHash(statement: string): string;
  PANEL_EXCLUSIONS: Array<{
    corpusId: string;
    source: string;
    panelId: number;
    mustMatch: RegExp;
    sha256: string;
    reason: string;
  }>;
}

interface Panelish {
  id: number;
  type: string;
  gridPos: { x: number; y: number; w: number; h: number };
  'x-navixy'?: { sql?: { statement?: string } };
}

const panelsOf = (entry: CorpusEntry): Panelish[] => entry.schema.panels as Panelish[];
const statementOf = (panel: Panelish): string | undefined => panel['x-navixy']?.sql?.statement;
const NO_SQL_TYPES = new Set(['text', 'row']);
const sqlPanelsOf = (entry: CorpusEntry): Panelish[] =>
  panelsOf(entry).filter((p) => !NO_SQL_TYPES.has(p.type));

function entryById(id: string): CorpusEntry {
  const entry = AGENT_CORPUS.find((e) => e.id === id);
  if (!entry) throw new Error(`corpus entry ${id} missing`);
  return entry;
}

describe('agent corpus', () => {
  // (a) Drift gate: the committed corpus must equal the generator's transform over
  // the on-disk fixtures. The transform is IMPORTED from the .mjs, not re-implemented
  // here — a re-implementation could diverge from the generator and gate nothing.
  it('drift gate: committed AGENT_CORPUS equals the transform re-run over schemas/*.json', async () => {
    const generator = (await import(GENERATOR_URL)) as unknown as GeneratorModule;
    const rebuilt = generator.buildCorpus(generator.loadFixtures(SCHEMAS_DIR));
    expect(rebuilt).toEqual(AGENT_CORPUS);
  });

  // (a2) Byte gate: the committed file must be exactly what the generator would
  // write, so idempotence is enforced in CI rather than by whoever remembers to
  // regenerate. .gitattributes pins the file to eol=lf, so a checkout cannot
  // mangle the comparison.
  it('committed corpus.generated.ts is byte-identical to the generator output', async () => {
    const generator = (await import(GENERATOR_URL)) as unknown as GeneratorModule;
    const notes: DropNote[] = [];
    const corpus = generator.buildCorpus(generator.loadFixtures(SCHEMAS_DIR), notes);
    const committed = readFileSync(
      fileURLToPath(new URL('../corpus.generated.ts', import.meta.url)), 'utf8');
    expect(generator.renderModule(corpus, notes)).toBe(committed);
  });

  // (b) Every shipped statement passes the real guard — the exact module
  // /api/sql-new/execute runs. A guard pass says NOTHING about execution: the real
  // agent's hallucinated `o.employee_id` passed this exact guard and failed at the
  // database with 42703. PF-1 (49/49 statements returning data against a live
  // iotDbUrl) is the separate, manual execution evidence.
  it('every corpus statement passes validateSQLQuerySafe (49/49)', () => {
    let checked = 0;
    for (const entry of AGENT_CORPUS) {
      for (const panel of sqlPanelsOf(entry)) {
        const statement = statementOf(panel);
        expect(typeof statement).toBe('string');
        const verdict = validateSQLQuerySafe(statement as string);
        if (!verdict.valid) {
          throw new Error(`${entry.id} panel ${panel.id}: ${JSON.stringify(verdict.error)}`);
        }
        checked += 1;
      }
    }
    expect(checked).toBe(49);
  });

  // (c) This asserts structural SAFETY, not correctness. A green corpus test is not
  // evidence that agent output will work — the corpus is hand-written SQL that
  // shipped, while the real agent invents SQL per turn and can hallucinate columns
  // no static gate can see. Warnings are pinned by name so a validator
  // re-calibration cannot silently change what the corpus tolerates.
  it('validateDashboard: zero errors for all six; warnings exactly as pinned', () => {
    const expectedWarnings: Record<string, string[]> = {
      'fleet-anomaly': ['MISSING_NAVIXY_EXT'],
      'fleet-reports': [],
      'engine-operation': [],
      leasing: [],
      'vehicle-mileage': [],
      'driver-performance': ['PANEL_OVERLAP', 'PANEL_OVERLAP', 'PANEL_OVERLAP'],
    };
    for (const entry of AGENT_CORPUS) {
      const { errors, warnings } = validateDashboard(entry.schema);
      expect({ id: entry.id, codes: errors.map((i) => i.code) }).toEqual({ id: entry.id, codes: [] });
      expect({ id: entry.id, codes: warnings.map((i) => i.code) }).toEqual({
        id: entry.id,
        codes: expectedWarnings[entry.id],
      });
    }
  });

  // (d) C5: corpus SQL is placeholder-free, so it always takes the strict
  // assertSafeSelect path and binds no parameters.
  it('no statement contains ${', () => {
    for (const entry of AGENT_CORPUS) {
      for (const panel of panelsOf(entry)) {
        const statement = statementOf(panel);
        if (statement !== undefined) {
          expect(statement.includes('${')).toBe(false);
        }
      }
    }
  });

  // (e) Every panel type is renderable by the live dispatch — imported from the
  // validator, not re-listed here.
  it('every panel type is in RENDERABLE_PANEL_TYPES', () => {
    const renderable = new Set<string>(RENDERABLE_PANEL_TYPES);
    for (const entry of AGENT_CORPUS) {
      for (const panel of panelsOf(entry)) {
        if (!renderable.has(panel.type)) {
          throw new Error(`${entry.id} panel ${panel.id}: type '${panel.type}' is not renderable`);
        }
      }
    }
  });

  // (f) Geomap coordinate rule (§3.3): detectGPSColumns matches by SUBSTRING,
  // first-match-wins in column order, so lat/lon must be the FIRST TWO projected
  // columns under safe names — nothing may precede them.
  it('geomap panels project lat/lon first, under safe aliases', () => {
    const geomaps: Array<{ entry: string; panel: Panelish }> = [];
    for (const entry of AGENT_CORPUS) {
      for (const panel of panelsOf(entry)) {
        if (panel.type === 'geomap') geomaps.push({ entry: entry.id, panel });
      }
    }
    expect(geomaps.map((g) => `${g.entry}#${g.panel.id}`)).toEqual(['fleet-reports#11']);
    for (const { entry, panel } of geomaps) {
      const [first, second] = firstTwoProjectedNames(statementOf(panel) as string);
      expect({ entry, first, ok: ['lat', 'latitude'].includes(first ?? '') })
        .toEqual({ entry, first, ok: true });
      expect({ entry, second, ok: ['lon', 'lng', 'longitude'].includes(second ?? '') })
        .toEqual({ entry, second, ok: true });
    }
  });

  // (g) The assertion that compaction ran: per entry, the union of occupied
  // [y, y+h) bands is one contiguous interval starting at 0, and the total height
  // is pinned. Gap-only — overlap belongs to (c)'s warning assertion, one rule in
  // one place. Heights are literals on purpose: a transform change must be loud.
  it('no vertical gap; heights pinned at 49, 88, 54, 80, 29, 66', () => {
    const expectedHeights: Record<string, number> = {
      'fleet-anomaly': 49,
      'fleet-reports': 88,
      'engine-operation': 54,
      leasing: 80,
      'vehicle-mileage': 29,
      'driver-performance': 66,
    };
    for (const entry of AGENT_CORPUS) {
      const bands = panelsOf(entry)
        .map((p) => [p.gridPos.y, p.gridPos.y + p.gridPos.h] as const)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      let coveredTo = 0;
      for (const [from, to] of bands) {
        if (from > coveredTo) {
          throw new Error(`${entry.id}: vertical gap [${coveredTo}, ${from})`);
        }
        coveredTo = Math.max(coveredTo, to);
      }
      expect({ id: entry.id, height: coveredTo }).toEqual({
        id: entry.id,
        height: expectedHeights[entry.id],
      });
    }
  });

  // (h) Anti-rot: each declared exclusion must still match its source fixture —
  // the offending clause is still there AND the whole statement is byte-for-byte
  // (modulo whitespace) the one the exclusion was declared against. Any upstream
  // edit to that statement, including one that fixes the 42703 while keeping the
  // ORDER BY text, fails here and forces the exclusion to be re-evaluated —
  // otherwise a now-good panel stays dropped forever.
  it('every declared exclusion still matches its source fixture', async () => {
    const generator = (await import(GENERATOR_URL)) as unknown as GeneratorModule;
    expect(generator.PANEL_EXCLUSIONS.length).toBeGreaterThan(0);
    for (const exclusion of generator.PANEL_EXCLUSIONS) {
      const fixture = JSON.parse(readFileSync(join(SCHEMAS_DIR, exclusion.source), 'utf8')) as {
        panels: Panelish[];
      };
      const panel = fixture.panels.find((p) => p.id === exclusion.panelId);
      expect(panel).toBeDefined();
      const statement = statementOf(panel as Panelish) ?? '';
      expect(exclusion.mustMatch.test(statement)).toBe(true);
      expect(generator.statementHash(statement)).toBe(exclusion.sha256);
    }
  });

  // (i) Shape and counts. Order is semantic: it is bestMatch()'s tie-break.
  it('shape: six entries in canonical order, pinned panel and SQL counts', () => {
    expect(AGENT_CORPUS.map((e) => e.id)).toEqual([
      'fleet-anomaly',
      'fleet-reports',
      'engine-operation',
      'leasing',
      'vehicle-mileage',
      'driver-performance',
    ]);
    expect(DEFAULT_CORPUS_ID).toBe('fleet-anomaly');
    expect(entryById(DEFAULT_CORPUS_ID)).toBeDefined();
    expect(AGENT_CORPUS.map((e) => ({ id: e.id, panels: panelsOf(e).length }))).toEqual([
      { id: 'fleet-anomaly', panels: 9 },
      { id: 'fleet-reports', panels: 11 },
      { id: 'engine-operation', panels: 9 },
      { id: 'leasing', panels: 9 },
      { id: 'vehicle-mileage', panels: 5 },
      { id: 'driver-performance', panels: 9 },
    ]);
    expect(AGENT_CORPUS.reduce((n, e) => n + panelsOf(e).length, 0)).toBe(52);
    expect(AGENT_CORPUS.reduce((n, e) => n + sqlPanelsOf(e).length, 0)).toBe(49);
  });

  // (j) Keyword invariants across rows: exact duplicates and substrings both make
  // one message score on two rows systematically.
  it('keywords: no cross-row duplicates, no cross-row substrings', () => {
    for (const a of AGENT_CORPUS) {
      for (const b of AGENT_CORPUS) {
        if (a.id === b.id) continue;
        for (const ka of a.keywords) {
          for (const kb of b.keywords) {
            expect({ a: a.id, b: b.id, ka, kb, dup: ka === kb }).toEqual({
              a: a.id, b: b.id, ka, kb, dup: false,
            });
            expect({ a: a.id, b: b.id, ka, kb, substring: kb.includes(ka) }).toEqual({
              a: a.id, b: b.id, ka, kb, substring: false,
            });
          }
        }
      }
    }
  });
});

/** First two projected column names of a SELECT list: split the text between the
 *  first SELECT and its FROM on depth-0 commas, then take each item's trailing
 *  `AS alias` (fall back to the last dotted identifier). Good enough for the
 *  corpus's plain projections; not a SQL parser. */
function firstTwoProjectedNames(sql: string): [string | undefined, string | undefined] {
  const match = /select\s+([\s\S]*?)\s+from\s/i.exec(sql);
  if (!match || match[1] === undefined) return [undefined, undefined];
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of match[1]) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      items.push(current);
      current = '';
    } else {
      current += ch;
    }
    if (items.length === 2) break;
  }
  if (items.length < 2 && current.trim() !== '') items.push(current);
  const nameOf = (item: string): string | undefined => {
    const aliased = /\sas\s+"?([a-z_][a-z0-9_]*)"?\s*$/i.exec(item.trim());
    if (aliased) return aliased[1]?.toLowerCase();
    const bare = /([a-z_][a-z0-9_]*)\s*$/i.exec(item.trim());
    return bare?.[1]?.toLowerCase();
  };
  return [items[0] !== undefined ? nameOf(items[0]) : undefined,
    items[1] !== undefined ? nameOf(items[1]) : undefined];
}
