#!/usr/bin/env node
/**
 * Regenerates backend/src/services/agent/corpus.generated.ts from the repo-root
 * schemas/*.json fixtures (DO-313).
 *
 *   cd backend && npm run build:agent-corpus
 *
 * This directory (backend/scripts/) is deliberately outside backend/tsconfig.json's
 * include ("src/**") so the script needs no lint or typecheck exemption, and it can
 * resolve ../schemas with a stable relative path.
 *
 * Why the corpus is a GENERATED, COMMITTED .ts module and not a runtime read or a
 * JSON import — both alternatives work locally and fail only in Docker:
 *
 *  1. schemas/ is outside the backend Docker build context. docker-compose.yml sets
 *     `context: ./backend` and backend/Dockerfile is `COPY . .`, so repo-root
 *     schemas/ never enters the image: readFileSync('../schemas/...') works under
 *     `tsx watch` and throws ENOENT in production.
 *  2. Only dist/ survives into the runtime image (`COPY --from=builder /app/dist
 *     ./dist`), so the data must live inside a compiled module.
 *  3. `rootDir: "./src"` makes a static import from ../schemas a TS6059 error.
 *     Note that `resolveJsonModule: true` IS set — that flag only governs whether
 *     TS understands a JSON module; rootDir and the Docker context are what kill
 *     the import.
 *  4. Node ESM would additionally require `with { type: 'json' }`, which
 *     `verbatimModuleSyntax` will not synthesize; there is zero precedent for a
 *     JSON import anywhere in backend/src.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The corpus config. Hand-maintained. Regenerating MUST NOT change this table.
 *
 * `keywords` are pruned: `report`, `hours` and `where` were removed because each
 * produced systematic multi-row misroutes in this domain (`report` is this
 * codebase's own noun for a dashboard; `hours` collides with ordinary time
 * language; `where` is a stopword). Do not restore them.
 *
 * Array ORDER IS SEMANTIC: bestMatch() in mockAgent.ts breaks score ties by
 * first-wins over this order. Reordering these rows changes which dashboard an
 * ambiguous message resolves to.
 *
 * `anomalies` stays even though the matcher is plural-tolerant: its `(?:s|es)?`
 * suffix cannot derive the irregular y -> ies form.
 */
export const CORPUS_CONFIG = [
  { id: 'fleet-anomaly',      source: '01-fleet-anomaly-monitor-schema.json',
    keywords: ['anomaly', 'anomalies', 'alert', 'fault', 'incident', 'exception', 'outlier', 'problem'] },
  { id: 'fleet-reports',      source: '03-fleet-reports-dashboard-schema.json',
    keywords: ['map', 'location', 'geo', 'position', 'route'] },
  { id: 'engine-operation',   source: '05-heavy-machinery-engine-operation-schema.json',
    keywords: ['engine', 'machinery', 'excavator', 'idle', 'idling', 'runtime'] },
  { id: 'leasing',            source: '06-leasing-dashboard-schema.json',
    keywords: ['leasing', 'lease', 'rental', 'contract', 'customer', 'billing'] },
  { id: 'vehicle-mileage',    source: '09-vehicle-mileage-dashboard-schema.json',
    keywords: ['mileage', 'distance', 'odometer', 'km', 'kilometre', 'kilometer', 'travel'] },
  { id: 'driver-performance', source: '12-driver-performance-dashboard-schema.json',
    keywords: ['driver', 'driving', 'score', 'behaviour', 'behavior', 'safety', 'harsh'] },
];

export const DEFAULT_CORPUS_ID = 'fleet-anomaly';

/*
 * Excluded fixtures — and why they must not be "helpfully" added back:
 *
 * Size/bytes: 02 (33 panels / 35.0 KB), 04 (25 / 47.1 KB), 07 (65.0 KB),
 * 08 (22 / 23.8 KB, also 3 broken panels), 10 (49 / 56.7 KB), 11 (57.3 KB).
 * Topic: 13 (overlaps 12, and collides with 05 on `idle`/`idling`).
 *
 * Content: 14-hw-asset-detail — its text panel documents a per-asset
 * ${object_label} selector while all 6 SQL panels open with
 * `WITH target AS (SELECT device_id FROM raw_business_data.objects WHERE
 * is_deleted IS NOT TRUE)` — all devices, no predicate — and it ships a live
 * templating.list entry rendering an Asset dropdown that does nothing. It is
 * attached to the agent-contract handover as a SHAPE example regardless; the
 * exclusion here is about its content, not its shape.
 */

/**
 * Rule (b) exclusions: a declared, keyed, self-invalidating list — NOT a generic
 * execution probe. Four reasons, in order of weight:
 *
 *  1. A build-time execution check needs a live database in the build path. The
 *     generator produces a committed artifact and the drift-gate test re-runs the
 *     same transform inside `npm test`; a DB-dependent transform would make
 *     `cd backend && npm test` require iotDbUrl credentials — in CI, in Docker,
 *     on every contributor's laptop. That converts a hermetic unit test into an
 *     integration test against a customer tenant.
 *  2. It would make the corpus non-deterministic: several statements are windowed
 *     (INTERVAL '7 days' / '30 days'), so a quiet weekend or a tenant with no
 *     matching sensors would silently drop a different panel set and fail the
 *     drift gate with no code change. A corpus that changes shape based on
 *     yesterday's telemetry is not a fixture.
 *  3. The failure class is a one-time, closed, enumerable set: PF-1 found exactly
 *     4 such panels across all 14 fixtures, all the same template-placeholder
 *     mistake (the other three are in 08-trips-dashboard-yesterday — a separate
 *     repo defect, filed outside DO-313, and fixed by none of this).
 *  4. Credentials in the codegen path is a security regression for a list of
 *     length one.
 *
 * Never "fix" SQL inside this generator: rewriting a statement reintroduces
 * unverified SQL into the one place in this feature that is supposed to be
 * known-good.
 *
 * Each entry is asserted against the source fixture on every run, two ways:
 * the panel must still exist with a statement matching `mustMatch`
 * (whitespace-tolerant because the fixture breaks the clause across CRLF lines),
 * AND the whole statement's whitespace-normalized sha256 must equal the pinned
 * `sha256`. The clause check alone pins the ORDER BY text, not the defect: an
 * upstream "fix" that re-aliases the SELECT list to AS category / AS series
 * (genuinely curing the 42703) while keeping the clause would slip past it and
 * the now-good panel would stay dropped forever (MR !56 review). Any statement
 * change trips the hash and forces a re-evaluation. If upstream touches the
 * fixture, the build fails loudly instead of silently dropping a good panel.
 */
export const PANEL_EXCLUSIONS = [
  {
    corpusId: 'engine-operation',
    source: '05-heavy-machinery-engine-operation-schema.json',
    panelId: 6,
    mustMatch: /ORDER\s+BY\s+category\s*,\s*series/i,
    sha256: 'c2766ed56c399733a1e5874ffdd2091129e274b7bc3e8418608d87aa6a63ea37',
    reason:
      'Workload by band (7d): ORDER BY category, series names columns the SELECT does not ' +
      'project (object_label, engine_hours, load_band). Fails at execution with 42703 and has ' +
      'never worked in this app — it renders as an error tile today (PF-1).',
  },
];

/** Whitespace-normalized sha256 of a statement — the exclusion pin above. */
export function statementHash(statement) {
  return createHash('sha256').update(statement.replace(/\s+/g, ' ').trim()).digest('hex');
}

/** Panel types that legitimately carry no SQL statement (drop rule (a) exempts
 *  them). `row` appears in zero of the 14 fixtures; it is exempt defensively so
 *  a real Grafana dashboard with row panels would not have them eaten. */
const NO_SQL_TYPES = new Set(['text', 'row']);

function sqlStatement(panel) {
  const nav = panel['x-navixy'];
  const sql = nav && typeof nav === 'object' ? nav.sql : undefined;
  const statement = sql && typeof sql === 'object' ? sql.statement : undefined;
  return typeof statement === 'string' ? statement : undefined;
}

function fail(message) {
  throw new Error(`build-agent-corpus: ${message}`);
}

/**
 * Transform one raw fixture into its shipped corpus schema:
 * drop all (rules (a) and (b)) -> compact -> canonical panel sort.
 *
 * `notes`, when given, collects one {source, panelId, reason} record per dropped
 * panel — the generated file's header derives its dropped-panels section from
 * the ACTUAL transform rather than a hand-written list that could drift.
 */
export function transformFixture(config, raw, notes) {
  const schema = structuredClone(raw);
  if (!Array.isArray(schema.panels) || schema.panels.length === 0) {
    fail(`${config.id}: source fixture has no panels array`);
  }

  const seenIds = new Set();
  for (const panel of schema.panels) {
    if (seenIds.has(panel.id)) fail(`${config.id}: duplicate panel id ${panel.id} in source fixture`);
    seenIds.add(panel.id);
    const gp = panel.gridPos;
    if (!gp || typeof gp !== 'object'
      || ![gp.x, gp.y, gp.w, gp.h].every((v) => Number.isInteger(v))) {
      // Fail with a diagnostic naming the fixture and panel instead of dying in
      // a sort comparator with a bare TypeError.
      fail(`${config.id}: panel id ${panel.id} has no usable gridPos (integer x/y/w/h required)`);
    }
  }

  const exclusions = PANEL_EXCLUSIONS.filter((e) => e.corpusId === config.id);
  for (const exclusion of exclusions) {
    const panel = schema.panels.find((p) => p.id === exclusion.panelId);
    const statement = panel ? sqlStatement(panel) ?? '' : '';
    if (!panel || !exclusion.mustMatch.test(statement)) {
      fail(
        `declared exclusion ${exclusion.source}/#${exclusion.panelId} no longer matches — ` +
        'remove it from PANEL_EXCLUSIONS',
      );
    }
    if (statementHash(statement) !== exclusion.sha256) {
      fail(
        `declared exclusion ${exclusion.source}/#${exclusion.panelId} statement changed ` +
        `(normalized sha256 ${statementHash(statement)}, pinned ${exclusion.sha256}) — ` +
        're-evaluate the exclusion and update PANEL_EXCLUSIONS',
      );
    }
  }

  // Drop ALL panels first, then compact (MR2-C3): the hole test must run against
  // the panel set after every drop, or a panel that is itself about to be dropped
  // registers as a false clash and trips the fail-closed assert below.
  const excludedIds = new Set(exclusions.map((e) => e.panelId));
  const dropped = [];
  const kept = [];
  for (const panel of schema.panels) {
    const statement = sqlStatement(panel);
    // Rule (a) — generic, static: a non-text/row panel with an absent or empty
    // statement renders as a dead "No SQL configured" tile.
    const emptySql = !NO_SQL_TYPES.has(panel.type) && (statement === undefined || statement.trim() === '');
    // Rule (b) — the declared exclusion list above.
    if (emptySql || excludedIds.has(panel.id)) {
      dropped.push(panel);
      notes?.push({
        source: config.source,
        panelId: panel.id,
        reason: excludedIds.has(panel.id)
          ? exclusions.find((e) => e.panelId === panel.id)?.reason ?? ''
          : 'empty SQL statement (drop rule (a)): renders as a dead "No SQL configured" tile.',
      });
    } else {
      kept.push(panel);
    }
  }
  if (kept.length === 0) fail(`${config.id}: every panel was dropped`);

  // Compaction operates on gridPos.y, never array index — schemas/*.json panel
  // arrays are NOT sorted by y (fixture 05 has id 6 before id 7; fixture 03's
  // geomap is the last array element). Holes are closed bottom-up (descending y)
  // so a shift below one hole cannot invalidate the recorded coordinates of the
  // holes above it.
  dropped.sort((a, b) => b.gridPos.y - a.gridPos.y);
  for (const gone of dropped) {
    const { x, y, w, h } = gone.gridPos;
    const intersects = kept.some((p) => p.gridPos.y < y + h && p.gridPos.y + p.gridPos.h > y);
    if (x !== 0 || w !== 24 || intersects) {
      fail(
        `${config.id}: cannot compact after dropping panel id ${gone.id} ` +
        `(gridPos ${JSON.stringify(gone.gridPos)}): the rule only closes a full-width band ` +
        'no remaining panel intersects. Do not guess a layout — extend the rule deliberately.',
      );
    }
    for (const p of kept) {
      if (p.gridPos.y >= y + h) p.gridPos.y -= h;
    }
  }

  // Canonical order: sort by (y, x, id). Rendering is absolute gridPos, so array
  // order is cosmetic — but a canonical order makes the generated artifact
  // invariant to source array order (B2-R7: reversing a fixture's panels array
  // must leave this file byte-identical).
  kept.sort((a, b) =>
    a.gridPos.y - b.gridPos.y || a.gridPos.x - b.gridPos.x || String(a.id).localeCompare(String(b.id)));

  schema.panels = kept;

  for (const panel of kept) {
    const statement = sqlStatement(panel);
    if (statement !== undefined && statement.includes('${')) {
      // C5: no corpus statement carries a template placeholder, so corpus SQL
      // always takes the strict assertSafeSelect path and binds no parameters.
      fail(`${config.id}: panel id ${panel.id} statement contains \${ — the corpus must stay placeholder-free`);
    }
  }

  return schema;
}

/** Load the six source fixtures. Returns a map keyed by file name. */
export function loadFixtures(schemasDir) {
  const fixtures = {};
  for (const { source } of CORPUS_CONFIG) {
    fixtures[source] = JSON.parse(readFileSync(join(schemasDir, source), 'utf8'));
  }
  return fixtures;
}

/** The full transform: config + raw fixtures -> the AGENT_CORPUS value.
 *  `notes`, when given, collects the dropped-panel records for renderModule. */
export function buildCorpus(fixtures, notes) {
  const ids = new Set();
  for (const config of CORPUS_CONFIG) {
    if (ids.has(config.id)) fail(`duplicate corpus id ${config.id}`);
    ids.add(config.id);
    for (const keyword of config.keywords) {
      // Keywords are embedded into generated single-quoted string literals and
      // compiled into regexes; anything outside [a-z] either breaks the emitted
      // module's syntax (an apostrophe) or silently never matches (a `+`).
      if (!/^[a-z]+$/.test(keyword)) {
        fail(`keyword "${keyword}" (${config.id}) must be lowercase a-z only`);
      }
    }
  }
  if (!ids.has(DEFAULT_CORPUS_ID)) fail(`DEFAULT_CORPUS_ID "${DEFAULT_CORPUS_ID}" is not a corpus row`);
  for (const exclusion of PANEL_EXCLUSIONS) {
    if (!ids.has(exclusion.corpusId)) fail(`exclusion targets unknown corpus id ${exclusion.corpusId}`);
  }

  // Keyword invariants across rows: exact duplicates and substrings both cause
  // one message to score on two rows systematically.
  for (const a of CORPUS_CONFIG) {
    for (const b of CORPUS_CONFIG) {
      if (a.id === b.id) continue;
      for (const ka of a.keywords) {
        for (const kb of b.keywords) {
          if (ka === kb) fail(`keyword "${ka}" appears in both ${a.id} and ${b.id}`);
          if (kb.includes(ka)) fail(`keyword "${ka}" (${a.id}) is a substring of "${kb}" (${b.id})`);
        }
      }
    }
  }

  return CORPUS_CONFIG.map((config) => {
    const raw = fixtures[config.source];
    if (!raw) fail(`missing source fixture ${config.source}`);
    return {
      id: config.id,
      keywords: [...config.keywords],
      schema: transformFixture(config, raw, notes),
    };
  });
}

function indentBlock(text, indent) {
  return text
    .split('\n')
    .map((line, i) => (i === 0 || line === '' ? line : indent + line))
    .join('\n');
}

/** Render the corpus module source text. Deterministic: same input -> same bytes.
 *  `notes` is the dropped-panel list collected by buildCorpus — the header
 *  documents what the transform ACTUALLY dropped, not a hand-written claim. */
export function renderModule(corpus, notes) {
  const totalPanels = corpus.reduce((n, e) => n + e.schema.panels.length, 0);
  const totalSql = corpus.reduce(
    (n, e) => n + e.schema.panels.filter((p) => !NO_SQL_TYPES.has(p.type)).length, 0);
  const perEntry = corpus
    .map((e) => ` *   ${e.id}: ${e.schema.panels.length} panels`)
    .join('\n');
  // Sorted so the header is invariant to source panel-array order (B2-R7).
  const droppedNotes = [...notes]
    .sort((a, b) => a.source.localeCompare(b.source) || a.panelId - b.panelId)
    .map((n) => ` *   ${n.source} panel id ${n.panelId} — ${n.reason}`)
    .join('\n');

  const entries = corpus
    .map((entry) => {
      const keywords = entry.keywords.map((k) => `'${k}'`).join(', ');
      const schemaJson = indentBlock(JSON.stringify(entry.schema, null, 2), '    ');
      return `  {\n    id: '${entry.id}',\n    keywords: [${keywords}],\n    schema: ${schemaJson},\n  },`;
    })
    .join('\n');

  return `/**
 * DO NOT EDIT — GENERATED FILE.
 *
 * Regenerate with:  cd backend && npm run build:agent-corpus
 * Source of truth:  backend/scripts/build-agent-corpus.mjs over repo-root schemas/*.json
 *
 * Why this is a generated, committed .ts module and not a runtime read or a JSON
 * import — both alternatives work locally and fail only in Docker:
 *  1. schemas/ is outside the backend Docker build context (docker-compose.yml
 *     \`context: ./backend\`; Dockerfile \`COPY . .\`), so readFileSync('../schemas/...')
 *     works under tsx watch and throws ENOENT in the production image.
 *  2. Only dist/ survives into the runtime image (\`COPY --from=builder /app/dist ./dist\`),
 *     so the data must live inside a compiled module.
 *  3. \`rootDir: "./src"\` makes a static import from ../schemas a TS6059 error. Note
 *     \`resolveJsonModule: true\` IS set — it governs whether TS understands a JSON
 *     module; rootDir and the Docker context are what kill the import.
 *  4. Node ESM would additionally need \`with { type: 'json' }\`, which
 *     \`verbatimModuleSyntax\` will not synthesize; there is zero precedent for a JSON
 *     import anywhere in backend/src.
 *
 * Panels dropped by the generator (derived from the actual transform; the rules
 * live in backend/scripts/build-agent-corpus.mjs — PANEL_EXCLUSIONS and rule (a)):
${droppedNotes}
 *
 * Shipped: ${corpus.length} entries, ${totalPanels} panels, ${totalSql} SQL statements.
${perEntry}
 */

export interface CorpusEntry {
  id: string;
  keywords: readonly string[];
  schema: Record<string, unknown>;
}

export const AGENT_CORPUS: readonly CorpusEntry[] = [
${entries}
];

export const DEFAULT_CORPUS_ID = '${DEFAULT_CORPUS_ID}';
`;
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(SCRIPT_DIR, '../src/services/agent/corpus.generated.ts');
const SCHEMAS_DIR = resolve(SCRIPT_DIR, '../../schemas');

function main() {
  const notes = [];
  const corpus = buildCorpus(loadFixtures(SCHEMAS_DIR), notes);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, renderModule(corpus, notes), 'utf8');
  const totalPanels = corpus.reduce((n, e) => n + e.schema.panels.length, 0);
  console.log(
    `corpus.generated.ts written: ${corpus.length} entries, ${totalPanels} panels ` +
    `(${corpus.map((e) => `${e.id}:${e.schema.panels.length}`).join(', ')})`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
