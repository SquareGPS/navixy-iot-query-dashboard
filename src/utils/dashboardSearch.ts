const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

export function getReportDescription(report: Record<string, unknown>): string {
  const schema = parseReportSchema(report);
  if (!schema) return '';

  const description = schema.description;
  return typeof description === 'string' ? description : '';
}

export function getReportType(report: Record<string, unknown>): 'composite' | 'dashboard' {
  const schema = parseReportSchema(report);
  return schema?.type === 'composite' ? 'composite' : 'dashboard';
}

function collectPanelTitles(panels: unknown, depth = 0): string[] {
  const titles: string[] = [];

  walkPanelsWithDepth(panels, depth, (panelRecord) => {
    if (typeof panelRecord.title === 'string' && panelRecord.title.trim()) {
      titles.push(panelRecord.title.trim());
    }
  });

  return titles;
}

function truncateForSearchIndex(sql: string): string {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_SQL_STATEMENT_INDEX_LENGTH) return normalized;
  return normalized.slice(0, MAX_SQL_STATEMENT_INDEX_LENGTH);
}

function collectSqlStatements(schema: Record<string, unknown>): string[] {
  const statements: string[] = [];

  if (typeof schema.sqlQuery === 'string' && schema.sqlQuery.trim()) {
    statements.push(truncateForSearchIndex(schema.sqlQuery));
  }

  walkPanelsWithDepth(schema.panels, 0, (panelRecord) => {
    const navixy = panelRecord['x-navixy'] as { sql?: { statement?: string } } | undefined;
    const sql = navixy?.sql?.statement;
    if (typeof sql === 'string' && sql.trim()) {
      statements.push(truncateForSearchIndex(sql));
    }
  });

  const templating = schema.templating as { list?: Array<{ query?: string }> } | undefined;
  if (Array.isArray(templating?.list)) {
    for (const variable of templating.list) {
      if (typeof variable.query === 'string' && variable.query.trim()) {
        statements.push(truncateForSearchIndex(variable.query));
      }
    }
  }

  return statements.slice(0, MAX_SQL_STATEMENTS_PER_DASHBOARD);
}

export function getReportPanelTitles(report: Record<string, unknown>): string[] {
  const schema = parseReportSchema(report);
  if (!schema) return [];

  return collectPanelTitles(schema.panels);
}

export function getReportSqlQueries(report: Record<string, unknown>): string[] {
  const schema = parseReportSchema(report);
  if (!schema) return [];

  return collectSqlStatements(schema);
}

function truncateSqlSnippet(sql: string, maxLength = 100): string {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
}

export function normalizeReportsForSearch(reports: Record<string, unknown>[]): SearchableDashboard[] {
  return reports
    .map((report) => {
      const id = String(report.id);
      if (!isValidReportId(id)) return null;

      return {
        id,
        title: typeof report.title === 'string' ? report.title : '',
        description: getReportDescription(report),
        panelTitles: getReportPanelTitles(report),
        sqlQueries: getReportSqlQueries(report),
        type: getReportType(report),
        sectionName: typeof report.section_name === 'string' ? report.section_name : undefined,
      };
    })
    .filter((dashboard): dashboard is SearchableDashboard => dashboard !== null);
}

export function matchesKeywords(query: string, text: string): boolean {
  const keywords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return false;

  const haystack = text.toLowerCase();
  return keywords.every((keyword) => haystack.includes(keyword));
}

export function filterDashboardsByKeywords(
  dashboards: SearchableDashboard[],
  query: string,
  options: DashboardSearchFilterOptions = {},
): DashboardSearchResult[] {
  const { includeSqlInSearch = true, includeSqlSnippets = true } = options;
  const trimmed = query.trim();
  if (!trimmed) return [];

  return dashboards.flatMap((dashboard) => {
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
            .map((sql) => truncateSqlSnippet(sql))
            .slice(0, 2)
        : [];

    return [{ ...dashboard, matchedPanelTitles, matchedSqlSnippets }];
  });
}

export function getDashboardRoute(dashboard: SearchableDashboard): string | null {
  if (!isValidReportId(dashboard.id)) return null;

  return dashboard.type === 'composite'
    ? `/app/composite-report/${dashboard.id}`
    : `/app/report/${dashboard.id}`;
}
