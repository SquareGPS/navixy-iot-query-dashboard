/**
 * Purpose-built validator for agent-produced `report_schema` JSON
 * (DO-313 / DO-342). The agent route runs it on every `type:'result'` turn,
 * from either agent implementation; any non-empty `errors` rewrites the turn
 * to `type:'error'` (D12). Warnings are logged and never block.
 *
 * THIS IS A SAFETY GATE, NEVER A CORRECTNESS GATE. It answers "can this
 * dashboard hurt us or fail to render", not "is this dashboard right". The
 * probe's own artifact passed every static check we have and still contained
 * a panel that failed at execution with `42703 column o.employee_id does not
 * exist`. Only execution catches that; preview-before-Apply is the actual
 * safety mechanism.
 *
 * CALIBRATION CAVEAT: the error/warning boundary below was fitted to the 14
 * shipped fixtures, not derived. Swept against all 14 (2026-07-21): ZERO
 * errors, 47 warnings — PANEL_OVERLAP on 02/10/11/12/13 (45 real overlapping
 * pairs that render correctly today, e.g. fixture 12's section-header text
 * panels over the table below them), MISSING_NAVIXY_EXT on 01 (no top-level
 * `x-navixy`, renders fine), EMPTY_SQL on 05 (a "New barchart" placeholder
 * with "statement": "" that renders as a "No SQL configured" tile). Promoting
 * any of these to an error blocks a dashboard the app ships. This is fitting
 * the gate to the sample — expect to re-tune it against the first real agent
 * responses.
 *
 * Hand-rolled rather than joi: joi IS a runtime dependency of this backend
 * (backend/package.json) but is unused anywhere in backend/src, and the rules
 * here are cross-field semantic checks (recursive row-child validation, id
 * uniqueness across all depths, grid-rect overlap, re-running the live SQL
 * guard), not shape assertions.
 * Deliberately independent of the dead frontend validator (C1), which rejects
 * fixtures the app ships today and checks none of the rules below.
 *
 * Returns a value on every path and never throws.
 */
import { validateSQLQuerySafe } from '../../utils/sqlValidationIntegration.js';

export interface DashboardIssue {
  code: string;
  message: string;
  path?: string;
}

export interface DashboardValidation {
  errors: DashboardIssue[];
  warnings: DashboardIssue[];
}

/** Panel types the live renderer can actually paint. Taken from the dispatch
 *  at DashboardRenderer.tsx:1932-1956 plus the two special cases — `text`
 *  short-circuits earlier (:1875) and `row` is never rendered directly.
 *  Everything else falls to the dispatch's default: "Unsupported panel type".
 *  NOT taken from renderer-core, which is dead (see types.ts). */
export const RENDERABLE_PANEL_TYPES = [
  'stat', 'kpi', 'bargauge', 'barchart', 'piechart', 'table',
  'timeseries', 'linechart', 'geomap', 'text', 'row',
] as const;

/** Mirrors GRID_COLUMNS = 24 (src/layout/geometry/grid.ts:5). The backend
 *  cannot import frontend modules, so the constant is restated here. */
const GRID_COLUMNS = 24;

const RENDERABLE = new Set<string>(RENDERABLE_PANEL_TYPES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isGridInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function issue(code: string, message: string, path?: string): DashboardIssue {
  return path === undefined ? { code, message } : { code, message, path };
}

/** True when the last non-blank line of the statement contains a `--` comment
 *  outside single- or double-quoted text. Such a statement passes validation,
 *  but the server-appended row cap lands inside the comment, so the query
 *  runs unbounded and dies on the 10 000-row limit (O8).
 *
 *  Quote state is tracked across the WHOLE statement, not just the last line:
 *  a multi-line string literal whose final line begins with `--` is inside the
 *  literal, not a comment. Earlier-line `--` comments are skipped to their end
 *  of line so quotes inside comment text cannot corrupt the state. Dollar
 *  quoting is not handled — acceptable for a gate that fails toward a warning
 *  log line, and no fixture or probe statement uses it. */
function hasTrailingLineComment(sql: string): boolean {
  // Locate the last non-blank line.
  let end = sql.length;
  let lineStart = -1;
  while (end > 0) {
    const nl = sql.lastIndexOf('\n', end - 1);
    if (sql.slice(nl + 1, end).trim() !== '') {
      lineStart = nl + 1;
      break;
    }
    end = nl < 0 ? 0 : nl;
  }
  if (lineStart < 0) return false;

  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < end; i++) {
    const ch = sql[i];
    if (inSingle) {
      if (ch === "'") {
        if (sql[i + 1] === "'") i++; // '' escape inside a literal
        else inSingle = false;
      }
    } else if (inDouble) {
      if (ch === '"') inDouble = false;
    } else if (ch === "'") {
      inSingle = true;
    } else if (ch === '"') {
      inDouble = true;
    } else if (ch === '-' && sql[i + 1] === '-') {
      if (i >= lineStart) return true;
      // A comment on an earlier line runs to its end of line; skip it so
      // apostrophes inside the comment text do not open a phantom literal.
      const eol = sql.indexOf('\n', i);
      if (eol === -1) return false;
      i = eol;
    }
  }
  return false;
}

interface PanelRect {
  path: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsIntersect(a: PanelRect, b: PanelRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function validateDashboard(schema: unknown): DashboardValidation {
  const errors: DashboardIssue[] = [];
  const warnings: DashboardIssue[] = [];

  if (!isPlainObject(schema)) {
    errors.push(issue('NOT_OBJECT', 'Dashboard schema must be a plain object (an array is not an object here).'));
    return { errors, warnings };
  }

  // §V-TITLE — the reconciled title rule. The agent emits NO separate
  // top-level title; the only title anywhere is report_schema.title. Two
  // rules must agree, and this is the single place both are stated:
  //  - validateDashboard enforces MISSING_TITLE on the dashboard schema's OWN
  //    `title` — i.e. on report_schema.title. That is the field the agent
  //    does emit, every repo fixture carries it, and a dashboard with no
  //    title is a genuine defect. It stays an error.
  //  - AgentChatResult.title is DERIVED by the service, never validated
  //    independently: report_schema.title when it is a non-empty string,
  //    else report_schema.uid, else 'Untitled dashboard'. Never fail a turn
  //    for a missing top-level result.title — there is no such field on the
  //    wire from the agent.
  if (!isNonEmptyString(schema.title)) {
    errors.push(issue('MISSING_TITLE', '`title` must be a non-empty string.', 'title'));
  }

  const panels = schema.panels;
  if (!Array.isArray(panels) || panels.length === 0) {
    errors.push(issue('MISSING_PANELS', '`panels` must be a non-empty array.', 'panels'));
  }

  const time = schema.time;
  if (!isPlainObject(time) || typeof time.from !== 'string' || typeof time.to !== 'string') {
    errors.push(issue('MISSING_TIME', '`time.from` and `time.to` must be strings.', 'time'));
  }

  // Warning, not error: fixture 01 ships without a top-level x-navixy and
  // renders fine (see the calibration caveat in the header).
  if (schema['x-navixy'] === undefined) {
    warnings.push(issue('MISSING_NAVIXY_EXT', 'No top-level `x-navixy` extension object.', 'x-navixy'));
  }

  // Panel ids are collected as String(id) because the renderer keys per-panel
  // state by String(panel.id); ids that stringify identically collide there.
  const idPaths = new Map<string, string[]>();
  const recordId = (id: unknown, path: string): void => {
    const key = String(id);
    const paths = idPaths.get(key);
    if (paths) paths.push(path);
    else idPaths.set(key, [path]);
  };

  const rects: PanelRect[] = [];

  // The full SQL pipeline for one statement. Shared by data panels (where a
  // statement is required) and row/text panels (where one is merely present).
  const checkStatement = (statement: string, sqlPath: string, type: string | undefined): void => {
    // The highest-value rule in the file: validateSQLQuerySafe is the exact
    // wrapper the /api/sql-new/execute middleware itself calls, so a
    // statement that passes here cannot be one the execute endpoint will
    // then 422. Do not hand-roll the assertSafeSelect/assertSafeTemplate
    // dispatch — that would duplicate sqlValidationIntegration.ts:38-43.
    try {
      const result = validateSQLQuerySafe(statement);
      if (!result.valid) {
        const issues = result.error?.error.details?.issues ?? [];
        const detail = issues.map((i) => `${i.code}: ${i.message}`).join('; ')
          || result.error?.error.message
          || 'validation failed';
        errors.push(issue('SQL_REJECTED', `Statement rejected by the SQL guard — ${detail}`, sqlPath));
      }
    } catch (err) {
      // validateSQLQuerySafe is not supposed to throw; if it ever does,
      // failing closed keeps this function throw-free and the turn safe.
      const detail = err instanceof Error ? err.message : String(err);
      errors.push(issue('SQL_REJECTED', `SQL guard failed internally — ${detail}`, sqlPath));
    }

    // LIMIT ${var} survives the guard but breaks at bind time: the bound
    // text is `LIMIT $1`, the server's LIMIT probe misses it and appends a
    // second cap -> `LIMIT $1 LIMIT 10000` -> syntax error.
    if (/\bLIMIT\s*\$\{/i.test(statement)) {
      errors.push(issue('LIMIT_PLACEHOLDER', 'Never `LIMIT ${var}` — the bound statement gets a second LIMIT appended and fails at execution.', sqlPath));
    }

    if (hasTrailingLineComment(statement)) {
      errors.push(issue('TRAILING_COMMENT', 'The last non-blank line contains a `--` comment; the appended row cap would land inside it and the query would run unbounded (O8).', sqlPath));
    }

    // geomap is the only panel type whose rendering is column-NAME
    // sensitive: detectGPSColumns (DashboardRenderer.tsx:1583-1620) matches
    // lat/lon substrings over the projected columns.
    if (type === 'geomap') {
      const hasLat = /\b(lat|latitude)\b/i.test(statement);
      const hasLon = /\b(lon|lng|longitude)\b/i.test(statement);
      if (!hasLat && !hasLon) {
        warnings.push(issue('GEOMAP_NO_COORD_ALIAS', 'geomap statement projects no lat/latitude and no lon/lng/longitude token; the map cannot find its coordinates.', sqlPath));
      }
    }
  };

  // One panel, at any depth. Collapsed-row children get the FULL per-panel
  // treatment: the renderer's row expansion promotes them to ordinary panels,
  // so a malformed child that would sail through here crashes expansion at
  // runtime instead — exactly the failure this gate exists to prevent.
  // Depth is structurally capped at 1: Grafana rows cannot nest, so a child
  // of type 'row' is an error and is never descended into.
  const validatePanel = (panel: unknown, path: string, isRowChild: boolean): void => {
    if (!isPlainObject(panel)) {
      errors.push(issue('UNKNOWN_PANEL_TYPE', 'Panel is not an object, so it has no usable type.', path));
      return;
    }

    const type = typeof panel.type === 'string' ? panel.type : undefined;
    if (type === undefined || !RENDERABLE.has(type)) {
      errors.push(issue(
        'UNKNOWN_PANEL_TYPE',
        `Panel type ${type === undefined ? '(missing)' : `'${type}'`} is not renderable. Renderable types: ${RENDERABLE_PANEL_TYPES.join(', ')}.`,
        `${path}.type`,
      ));
    } else if (isRowChild && type === 'row') {
      errors.push(issue(
        'NESTED_ROW',
        'A collapsed row child cannot itself be a row — Grafana rows do not nest, and row expansion would mis-render it.',
        `${path}.type`,
      ));
    }

    // The renderer keys per-panel state by String(panel.id), so an absent
    // id breaks state isolation between panels — including expanded children.
    if (panel.id === undefined || panel.id === null) {
      errors.push(issue('MISSING_PANEL_ID', 'Panel has no `id`.', `${path}.id`));
    } else {
      recordId(panel.id, path);
    }

    const gridPos = panel.gridPos;
    let gx: number | undefined;
    let gy: number | undefined;
    let gw: number | undefined;
    let gh: number | undefined;
    if (isPlainObject(gridPos)) {
      const { x, y, w, h } = gridPos;
      if (isGridInt(x) && isGridInt(y) && isGridInt(w) && isGridInt(h) && w >= 1 && h >= 1 && x >= 0) {
        gx = x; gy = y; gw = w; gh = h;
      }
    }
    if (gx === undefined || gy === undefined || gw === undefined || gh === undefined) {
      errors.push(issue(
        'BAD_GRIDPOS',
        '`gridPos` must be an object with integer x/y/w/h, w >= 1, h >= 1, x >= 0.',
        `${path}.gridPos`,
      ));
    } else {
      if (gx + gw > GRID_COLUMNS) {
        errors.push(issue(
          'GRIDPOS_OVERFLOW',
          `gridPos.x + gridPos.w = ${gx + gw} exceeds the ${GRID_COLUMNS}-column grid.`,
          `${path}.gridPos`,
        ));
      }
      // Overlap stays a top-level heuristic: a collapsed child's gridPos
      // describes the post-expansion layout, so comparing it against
      // top-level rects would fabricate pairs that never co-exist on screen.
      if (!isRowChild && type !== 'row') {
        rects.push({ path, x: gx, y: gy, w: gw, h: gh });
      }
    }

    if (type === 'row' && !isRowChild) {
      const children = panel.panels;
      if (children !== undefined) {
        if (!Array.isArray(children)) {
          errors.push(issue(
            'BAD_ROW_PANELS',
            '`panels` on a row must be an array when present — row expansion iterates it.',
            `${path}.panels`,
          ));
        } else {
          children.forEach((child: unknown, childIndex: number) => {
            validatePanel(child, `${path}.panels[${childIndex}]`, true);
          });
        }
      }
    }

    const nav = panel['x-navixy'];
    const sqlNode = isPlainObject(nav) && isPlainObject(nav.sql) ? nav.sql : undefined;
    const statement = sqlNode?.statement;
    const sqlPath = `${path}.x-navixy.sql.statement`;

    // text panels short-circuit before the SQL fetch and row panels are never
    // rendered directly — so neither REQUIRES a statement. But the renderer's
    // fetch loop still submits a statement it finds on a row, so any
    // non-empty statement present on either is validated in full: nothing may
    // smuggle non-SELECT SQL past this gate by sitting on a row/text panel.
    if (type === 'text' || type === 'row') {
      if (typeof statement === 'string' && statement.trim() !== '') {
        checkStatement(statement, sqlPath, type);
      }
      return;
    }

    if (typeof statement !== 'string') {
      errors.push(issue(
        'MISSING_SQL',
        '`x-navixy.sql.statement` must be a string on every panel that is not text/row.',
        sqlPath,
      ));
      return;
    }
    if (statement.trim() === '') {
      // Warning, not error: fixture 05 ships a "New barchart" placeholder with
      // "statement": "" and the live renderer handles it gracefully ("No SQL
      // configured") — it renders, so by this file's own boundary it is
      // suspicious, not broken. An ABSENT statement stays an error above:
      // a data panel with no SQL config at all is malformed output, not a
      // placeholder anyone shipped.
      warnings.push(issue(
        'EMPTY_SQL',
        'Statement is empty — the panel renders as a "No SQL configured" placeholder.',
        sqlPath,
      ));
      return;
    }

    checkStatement(statement, sqlPath, type);
  };

  if (Array.isArray(panels)) {
    panels.forEach((panel: unknown, index: number) => {
      validatePanel(panel, `panels[${index}]`, false);
    });
  }

  for (const [id, paths] of idPaths) {
    if (paths.length > 1) {
      errors.push(issue('DUPLICATE_PANEL_ID', `Panel id '${id}' is used ${paths.length} times (${paths.join(', ')}).`, paths[0]));
    }
  }

  // Warning, not error: fixture 12 (a corpus member) contains three real
  // one-row overlaps and renders correctly today (see the header caveat).
  for (let a = 0; a < rects.length; a++) {
    for (let b = a + 1; b < rects.length; b++) {
      const first = rects[a];
      const second = rects[b];
      if (first !== undefined && second !== undefined && rectsIntersect(first, second)) {
        warnings.push(issue('PANEL_OVERLAP', `Panels ${first.path} and ${second.path} overlap on the grid.`, first.path));
      }
    }
  }

  return { errors, warnings };
}
