import type { Dashboard } from '@/types/dashboard-types';
import { apiService } from '@/services/api';
import { filterUsedParameters } from '@/utils/sqlParameterExtractor';
import {
  findFilterPanels,
  getMultiselectFilters,
  multiselectStaticOptions,
  resolveDefaultPanelParams,
} from '@/utils/filterVariables';

export interface FilterDiscoveryResult {
  options: Record<string, string[]>;
  errors: Record<string, boolean>;
  /** Keys `${name}:${query}` that were successfully discovered this run. */
  discoveredKeys: string[];
}

/**
 * Run multiselect filter option discovery for a dashboard. Intended to complete
 * before panel SQL so filter queries get pool connections first.
 */
export async function discoverMultiselectFilterOptions(
  dashboard: Dashboard,
  options?: {
    /** Skip variables whose discovery key is in this set (already loaded). */
    cachedKeys?: Set<string>;
    onVariableStart?: (name: string) => void;
    onVariableEnd?: (name: string, values: string[], error: boolean) => void;
  }
): Promise<FilterDiscoveryResult> {
  const variables = getMultiselectFilters(dashboard);
  const result: FilterDiscoveryResult = {
    options: {},
    errors: {},
    discoveredKeys: [],
  };

  for (const variable of variables) {
    const staticOpts = multiselectStaticOptions(variable);
    if (staticOpts.length > 0) {
      result.options[variable.name] = staticOpts;
      continue;
    }
    if (!variable.query) continue;

    const discoveryKey = `${variable.name}:${variable.query}`;
    if (options?.cachedKeys?.has(discoveryKey)) {
      continue;
    }

    options?.onVariableStart?.(variable.name);

    try {
      const needsPanelContext = /\$\{[^}]+\}/.test(variable.query);
      const merged: Record<string, unknown> = {};
      if (needsPanelContext) {
        const filterPanels = findFilterPanels(variable, dashboard.panels);
        for (const p of filterPanels.length > 0 ? filterPanels : [undefined]) {
          const resolved = resolveDefaultPanelParams(dashboard, p);
          for (const [key, value] of Object.entries(resolved)) {
            if (!(key in merged)) merged[key] = value;
          }
        }
      }
      const params = filterUsedParameters(variable.query, merged);
      const res = await apiService.executeSQL({
        sql: variable.query,
        params,
        row_limit: 1000,
        timeout_ms: 30000,
      });
      if (res.error) {
        throw new Error(res.error.message || 'Discovery query failed');
      }
      const rows = res.data?.rows || [];
      const values = [
        ...new Set(
          rows
            .map((r: unknown[]) => r[0])
            .filter((x) => x !== null && x !== undefined)
            .map(String)
        ),
      ];
      result.options[variable.name] = values;
      result.discoveredKeys.push(discoveryKey);
      options?.onVariableEnd?.(variable.name, values, false);
    } catch (err) {
      console.error(`Discovery query for filter "${variable.name}" failed:`, err);
      result.errors[variable.name] = true;
      options?.onVariableEnd?.(variable.name, [], true);
    }
  }

  return result;
}
