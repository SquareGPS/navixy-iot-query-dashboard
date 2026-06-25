import { describe, it, expect } from 'vitest';
import type { Dashboard } from '@/types/dashboard-types';
import { applyWizardScopeInputFilters } from '@/utils/scopeInputFilter';

const groupDashboard: Dashboard = {
  id: 1,
  title: 'Test',
  panels: [],
  templating: {
    enable: true,
    list: [
      {
        name: 'object_group',
        type: 'custom',
        query: 'SELECT 1',
        'x-navixy': { control: 'multiselect', column: 'group_label' },
      },
    ],
  },
};

describe('applyWizardScopeInputFilters', () => {
  it('injects group EXISTS into device_list objects WHERE', () => {
    const sql =
      'device_list AS (\n    SELECT DISTINCT o.device_id \n    FROM raw_business_data.objects o\n    WHERE o.is_deleted IS NOT TRUE\n      AND (tp.object_labels_filter IS NULL OR o.object_label = ANY(tp.object_labels_filter))\n),';
    const result = applyWizardScopeInputFilters(
      sql,
      groupDashboard,
      { object_group: ['Logistic Office', 'Sales Office'] },
      undefined
    );
    expect(result).toContain('raw_business_data.groups _navixy_g');
    expect(result).toContain('${object_group}');
    expect(result).toContain('group_label::text = ANY');
  });

  it('injects trip device filter when SQL has no objects table', () => {
    const sql =
      'SELECT COUNT(*) AS value FROM processed_common_data.trips t WHERE t.trip_start_time >= CURRENT_DATE - INTERVAL \'1 day\'';
    const result = applyWizardScopeInputFilters(
      sql,
      groupDashboard,
      { object_group: ['Main Office'] },
      undefined
    );
    expect(result).toContain('t.device_id IN (SELECT o.device_id');
    expect(result).toContain('${object_group}');
  });

  it('skips when panel has output-column binding for the variable', () => {
    const sql =
      'SELECT COALESCE(g.group_label, \'x\') AS group_label FROM raw_business_data.objects o JOIN groups g';
    const result = applyWizardScopeInputFilters(
      sql,
      groupDashboard,
      { object_group: ['Main Office'] },
      [{ variable: 'object_group', column: 'group_label' }]
    );
    expect(result).toBe(sql);
  });

  it('does nothing when selection is empty (All)', () => {
    const sql = 'select count(*) from raw_business_data.objects o where o.is_deleted is FALSE';
    const result = applyWizardScopeInputFilters(
      sql,
      groupDashboard,
      { object_group: [] },
      undefined
    );
    expect(result).toBe(sql);
  });
});
