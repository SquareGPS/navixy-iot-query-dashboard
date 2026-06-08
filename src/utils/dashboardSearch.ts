// Accepts any RFC-4122-shaped UUID (any version nibble). Stricter variant checks
// would reject UUIDv7/v8 and nil UUIDs once id generation evolves.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PANEL_DEPTH = 20;
const MAX_SQL_STATEMENT_INDEX_LENGTH = 4096;
const MAX_SQL_STATEMENTS_PER_DASHBOARD = 50;

export interface SearchableDashboard {
  id: string;
  title: string;
  description: string;
  panelTitles: string[];
  sqlQueries: string[];
  type: 'composite' | 'dashboard';
  sectionName?: string;
}

export interface DashboardSearchResult extends SearchableDashboard {
  matchedPanelTitles: string[];
  matchedSqlSnippets: string[];
}

export interface DashboardSearchFilterOptions {
  includeSqlInSearch?: boolean;
  includeSqlSnippets?: boolean;
  maxResults?: number;
}

export function isValidReportId(id: string): boolean {
  return UUID_REGEX.test(id);
}

function parseReportSchema(report: Record<string, unknown>): Record<string, unknown> | null {
  const schema = report.report_schema;
  if (!schema) return null;
  if (typeof schema === 'string') {
    try {
      return JSON.parse(schema) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof schema === 'object') {
    return schema as Record<string, unknown>;
  }
  return null;
}

function walkPanelsWithDepth(
  panels: unknown,
  depth: number,
  visitor: (panel: Record<string, unknown>) => void,
): void {
  if (!Array.isArray(panels) || depth > MAX_PANEL_DEPTH) return;

  for (const panel of panels) {
    if (!panel || typeof panel !== 'object') continue;

    const panelRecord = panel as Record<string, unknown>;
    visitor(panelRecord);

    if (Array.isArray(panelRecord.panels)) {
      walkPanelsWithDepth(panelRecord.panels, depth + 1, visitor);
    }
  }
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncateText(text: string, maxLength: number): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

function getDescriptionFromSchema(schema: Record<string, unknown> | null): string {
  if (!schema) return '';
  const description = schema.description;
  return typeof description === 'string' ? description : '';
}

function getTypeFromSchema(schema: Record<string, unknown> | null): 'composite' | 'dashboard' {
  return schema?.type === 'composite' ? 'composite' : 'dashboard';
}

function collectPanelTitles(panels: unknown): string[] {
  const titles: string[] = [];

  walkPanelsWithDepth(panels, 0, (panelRecord) => {
    if (typeof panelRecord.title === 'string' && panelRecord.title.trim()) {
      titles.push(panelRecord.title.trim());
    }
  });

  return titles;
}

function collectSqlStatements(schema: Record<string, unknown>): string[] {
  const statements: string[] = [];

  if (typeof schema.sqlQuery === 'string' && schema.sqlQuery.trim()) {
    statements.push(truncateText(schema.sqlQuery, MAX_SQL_STATEMENT_INDEX_LENGTH));
  }

  walkPanelsWithDepth(schema.panels, 0, (panelRecord) => {
    const navixy = panelRecord['x-navixy'] as { sql?: { statement?: string } } | undefined;
    const sql = navixy?.sql?.statement;
    if (typeof sql === 'string' && sql.trim()) {
      statements.push(truncateText(sql, MAX_SQL_STATEMENT_INDEX_LENGTH));
    }
  });

  const templating = schema.templating as { list?: Array<{ query?: string }> } | undefined;
  if (Array.isArray(templating?.list)) {
    for (const variable of templating.list) {
      if (typeof variable.query === 'string' && variable.query.trim()) {
        statements.push(truncateText(variable.query, MAX_SQL_STATEMENT_INDEX_LENGTH));
      }
    }
  }

  return statements.slice(0, MAX_SQL_STATEMENTS_PER_DASHBOARD);
}

function buildSearchableDashboard(
  report: Record<string, unknown>,
  schema: Record<string, unknown> | null,
): SearchableDashboard | null {
  const id = String(report.id);
  if (!isValidReportId(id)) return null;

  return {
    id,
    title: typeof report.title === 'string' ? report.title : '',
    description: getDescriptionFromSchema(schema),
    panelTitles: schema ? collectPanelTitles(schema.panels) : [],
    sqlQueries: schema ? collectSqlStatements(schema) : [],
    type: getTypeFromSchema(schema),
    sectionName: typeof report.section_name === 'string' ? report.section_name : undefined,
  };
}

export function normalizeReportsForSearch(reports: Record<string, unknown>[]): SearchableDashboard[] {
  return reports
    .map((report) => buildSearchableDashboard(report, parseReportSchema(report)))
    .filter((dashboard): dashboard is SearchableDashboard => dashboard !== null);
}

export function matchesKeywords(query: string, text: string): boolean {
  const keywords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return false;

  const haystack = text.toLowerCase();
  return keywords.every((keyword) => haystack.includes(keyword));
}

function scoreDashboardMatch(
  dashboard: SearchableDashboard,
  query: string,
  includeSqlInSearch: boolean,
): number {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return 0;

  let score = 0;

  if (dashboard.title.toLowerCase() === trimmed) {
    score += 1000;
  } else if (matchesKeywords(trimmed, dashboard.title)) {
    score += 500;
  }

  for (const panelTitle of dashboard.panelTitles) {
    if (!matchesKeywords(trimmed, panelTitle)) continue;
    score += panelTitle.toLowerCase() === trimmed ? 300 : 200;
    break;
  }

  if (matchesKeywords(trimmed, dashboard.description)) {
    score += 100;
  }

  if (includeSqlInSearch) {
    for (const sql of dashboard.sqlQueries) {
      if (matchesKeywords(trimmed, sql)) {
        score += 50;
        break;
      }
    }
  }

  return score;
}

export function filterDashboardsByKeywords(
  dashboards: SearchableDashboard[],
  query: string,
  options: DashboardSearchFilterOptions = {},
): DashboardSearchResult[] {
  const { includeSqlInSearch = true, includeSqlSnippets = true, maxResults } = options;
  const trimmed = query.trim();
  if (!trimmed) return [];

  const results = dashboards.flatMap((dashboard) => {
    const searchableText = [
      dashboard.description,
      dashboard.title,
      ...dashboard.panelTitles,
      ...(includeSqlInSearch ? dashboard.sqlQueries : []),
    ]
      .filter(Boolean)
      .join(' ');

    if (!matchesKeywords(trimmed, searchableText)) {
      return [];
    }

    const matchedPanelTitles = dashboard.panelTitles.filter((title) =>
      matchesKeywords(trimmed, title),
    );

    const matchedSqlSnippets =
      includeSqlInSearch && includeSqlSnippets
        ? dashboard.sqlQueries
            .filter((sql) => matchesKeywords(trimmed, sql))
            .map((sql) => truncateText(sql, 100))
            .slice(0, 2)
        : [];

    return [{ ...dashboard, matchedPanelTitles, matchedSqlSnippets }];
  });

  results.sort(
    (a, b) => scoreDashboardMatch(b, trimmed, includeSqlInSearch) - scoreDashboardMatch(a, trimmed, includeSqlInSearch),
  );

  if (typeof maxResults === 'number') {
    return results.slice(0, maxResults);
  }

  return results;
}

export function getDashboardRoute(dashboard: SearchableDashboard): string | null {
  if (!isValidReportId(dashboard.id)) return null;

  return dashboard.type === 'composite'
    ? `/app/composite-report/${dashboard.id}`
    : `/app/report/${dashboard.id}`;
}

export function getDashboardSearchOptionId(dashboardId: string): string {
  return `dashboard-search-option-${dashboardId}`;
}
