import { describe, it, expect } from 'vitest';
import {
  filterDashboardsByKeywords,
  isValidReportId,
  matchesKeywords,
  normalizeReportsForSearch,
  type SearchableDashboard,
} from '../dashboardSearch';

const REPORT_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeDashboard(overrides: Partial<SearchableDashboard> = {}): SearchableDashboard {
  return {
    id: REPORT_ID,
    title: 'Fleet Dashboard',
    description: 'Fleet performance overview',
    panelTitles: ['Total Trips', 'Active Vehicles'],
    sqlQueries: ['SELECT COUNT(*) FROM business_data.tracks'],
    type: 'dashboard',
    sectionName: 'Operations',
    ...overrides,
  };
}

describe('isValidReportId', () => {
  it('accepts standard UUIDs regardless of version nibble', () => {
    expect(isValidReportId(REPORT_ID)).toBe(true);
    expect(isValidReportId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
  });

  it('rejects malformed ids', () => {
    expect(isValidReportId('../settings')).toBe(false);
    expect(isValidReportId('not-a-uuid')).toBe(false);
  });
});

describe('matchesKeywords', () => {
  it('requires every keyword to match as substring', () => {
    expect(matchesKeywords('fleet overview', 'Fleet performance overview')).toBe(true);
    expect(matchesKeywords('fleet mileage', 'Fleet performance overview')).toBe(false);
  });
});

describe('normalizeReportsForSearch', () => {
  it('parses schema once and extracts searchable fields', () => {
    const reports = normalizeReportsForSearch([
      {
        id: REPORT_ID,
        title: 'Trips',
        section_name: 'Ops',
        report_schema: {
          description: 'Yesterday trips',
          panels: [
            {
              title: 'Total Trips',
              'x-navixy': { sql: { statement: 'SELECT 1 FROM business_data.tracks' } },
            },
          ],
        },
      },
    ]);

    expect(reports).toHaveLength(1);
    expect(reports[0].description).toBe('Yesterday trips');
    expect(reports[0].panelTitles).toEqual(['Total Trips']);
    expect(reports[0].sqlQueries[0]).toContain('business_data.tracks');
  });

  it('drops reports with invalid ids', () => {
    const reports = normalizeReportsForSearch([
      { id: 'bad-id', title: 'Broken', report_schema: {} },
    ]);
    expect(reports).toHaveLength(0);
  });
});

describe('filterDashboardsByKeywords', () => {
  it('ranks title matches above sql matches', () => {
    const dashboards = [
      makeDashboard({
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Other Dashboard',
        description: 'misc',
        panelTitles: [],
        sqlQueries: ['SELECT fleet overview FROM logs'],
      }),
      makeDashboard({
        title: 'Fleet Overview',
        description: 'misc',
        panelTitles: [],
        sqlQueries: [],
      }),
    ];

    const results = filterDashboardsByKeywords(dashboards, 'fleet overview');
    expect(results[0].title).toBe('Fleet Overview');
  });

  it('excludes sql from search when disabled', () => {
    const dashboards = [
      makeDashboard({
        title: 'Hidden SQL Match',
        description: '',
        panelTitles: [],
        sqlQueries: ['SELECT secret_table FROM db'],
      }),
    ];

    const results = filterDashboardsByKeywords(dashboards, 'secret_table', {
      includeSqlInSearch: false,
      includeSqlSnippets: false,
    });
    expect(results).toHaveLength(0);
  });

  it('limits results when maxResults is set', () => {
    const dashboards = [
      makeDashboard({ id: '550e8400-e29b-41d4-a716-446655440001', title: 'Fleet A' }),
      makeDashboard({ id: '550e8400-e29b-41d4-a716-446655440002', title: 'Fleet B' }),
      makeDashboard({ id: '550e8400-e29b-41d4-a716-446655440003', title: 'Fleet C' }),
    ];

    const results = filterDashboardsByKeywords(dashboards, 'fleet', { maxResults: 2 });
    expect(results).toHaveLength(2);
  });
});
