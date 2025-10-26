/**
 * Query Planner
 * Builds execution plan with priorities and deduplication
 */

import type { GrafanaDashboard, Panel } from './grafana-dashboard';
import type { QueryPlan, RenderContext } from './runtime-types';
import { DashboardLoader } from './DashboardLoader';
import { VariableResolver } from './VariableResolver';
import { QueryClient } from './QueryClient';

export class Planner {
  private static readonly PRIORITY_WEIGHTS = {
    kpi: 1,        // Highest priority - small, fast
    stat: 1,        // Same as KPI
    barchart: 2,   // Above the fold charts
    linechart: 2,
    piechart: 2,
    table: 3,       // Lower priority - can be large
    text: 4,        // Lowest priority - annotations
  };

  /**
   * Build execution plan for dashboard
   */
  static build(
    dashboard: GrafanaDashboard,
    context: RenderContext,
    viewport?: { width: number; height: number }
  ): QueryPlan[] {
    const plans: QueryPlan[] = [];
    const queryFingerprints = new Set<string>();

    // Sort panels by priority and viewport visibility
    const sortedPanels = this.sortPanelsByPriority(dashboard.dashboard.panels, viewport);

    sortedPanels.forEach(panel => {
      if (!DashboardLoader.hasNavixyExtensions(panel)) {
        return; // Skip panels without SQL extensions
      }

      const navixyExt = DashboardLoader.getNavixyExtensions(panel);
      if (!navixyExt?.sql) {
        return;
      }

      const plan = this.createQueryPlan(panel, navixyExt, context);
      
      // Deduplicate identical queries
      if (!queryFingerprints.has(plan.fingerprint)) {
        queryFingerprints.add(plan.fingerprint);
        plans.push(plan);
      }
    });

    return plans;
  }

  /**
   * Sort panels by priority and viewport visibility
   */
  private static sortPanelsByPriority(
    panels: Panel[],
    viewport?: { width: number; height: number }
  ): Panel[] {
    return panels
      .map(panel => ({
        panel,
        priority: this.calculatePanelPriority(panel, viewport)
      }))
      .sort((a, b) => a.priority - b.priority)
      .map(item => item.panel);
  }

  /**
   * Calculate panel priority based on type and viewport
   */
  private static calculatePanelPriority(
    panel: Panel,
    viewport?: { width: number; height: number }
  ): number {
    const basePriority = this.PRIORITY_WEIGHTS[panel.type] || 5;
    
    // Adjust priority based on viewport visibility
    if (viewport) {
      const isVisible = this.isPanelInViewport(panel, viewport);
      return isVisible ? basePriority : basePriority + 10;
    }

    return basePriority;
  }

  /**
   * Check if panel is in viewport
   */
  private static isPanelInViewport(
    panel: Panel,
    viewport: { width: number; height: number }
  ): boolean {
    const panelTop = panel.gridPos.y;
    const panelBottom = panelTop + panel.gridPos.h;
    
    // Assume viewport starts at y=0 and extends to some reasonable height
    const viewportHeight = Math.min(viewport.height, 1000); // Cap at 1000px
    
    return panelTop < viewportHeight && panelBottom > 0;
  }

  /**
   * Create query plan for a panel
   */
  private static createQueryPlan(
    panel: Panel,
    navixyExt: any,
    context: RenderContext
  ): QueryPlan {
    const panelId = `panel_${panel.id}`;
    const priority = this.calculatePanelPriority(panel);
    const fingerprint = this.generateFingerprint(panel, navixyExt, context);

    return {
      panelId,
      priority,
      fingerprint,
      exec: async () => {
        try {
          // Resolve variable bindings
          const resolvedParams = this.resolvePanelParams(navixyExt, context);
          
          // Execute query
          const result = await QueryClient.execute({
            statement: navixyExt.sql.statement,
            params: resolvedParams,
            limits: navixyExt.sql.limits,
            readOnly: navixyExt.sql.readOnly ?? true,
            ...context.execution
          });

          return result;
        } catch (error) {
          return {
            data: { columns: [], rows: [] },
            error: {
              code: 'QUERY_EXECUTION_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
              details: { panelId, fingerprint }
            },
            stats: { elapsedMs: 0, cacheHit: false }
          };
        }
      }
    };
  }

  /**
   * Resolve panel parameters from context
   */
  private static resolvePanelParams(navixyExt: any, context: RenderContext): Record<string, unknown> {
    const resolvedParams: Record<string, unknown> = {};

    Object.entries(navixyExt.sql.bindings).forEach(([paramName, binding]) => {
      const bindingStr = String(binding);
      const paramSpec = navixyExt.sql.params[paramName];
      
      if (!paramSpec) {
        throw new Error(`Parameter spec not found for ${paramName}`);
      }

      // Resolve binding value
      let value = this.resolveBinding(bindingStr, context);
      
      // Coerce to parameter type
      value = VariableResolver.coerceToParamType(value, paramSpec.type);
      
      resolvedParams[paramName] = value;
    });

    return resolvedParams;
  }

  /**
   * Resolve binding value from context
   */
  private static resolveBinding(binding: string, context: RenderContext): unknown {
    // Handle special time bindings
    if (binding === '__from') {
      return context.time.from.getTime();
    }
    if (binding === '__to') {
      return context.time.to.getTime();
    }
    if (binding === '__from_iso') {
      return context.time.from.toISOString();
    }
    if (binding === '__to_iso') {
      return context.time.to.toISOString();
    }

    // Handle variable bindings
    if (binding.startsWith('$')) {
      const varName = binding.substring(1);
      if (varName in context.vars) {
        return context.vars[varName];
      }
      if (varName in context.bindings) {
        return context.bindings[varName];
      }
      throw new Error(`Variable not found: ${varName}`);
    }

    // Handle direct bindings
    if (binding in context.bindings) {
      return context.bindings[binding];
    }

    // Return as literal value
    return binding;
  }

  /**
   * Generate fingerprint for query deduplication
   */
  private static generateFingerprint(
    panel: Panel,
    navixyExt: any,
    context: RenderContext
  ): string {
    const statement = navixyExt.sql.statement;
    const params = navixyExt.sql.params;
    const bindings = navixyExt.sql.bindings;
    
    // Create a hash of the query and its parameter structure
    const fingerprintData = {
      statement,
      params: Object.keys(params).sort(),
      bindings: Object.entries(bindings).sort(),
      schemaVersion: context.execution.dialect
    };

    return this.hashObject(fingerprintData);
  }

  /**
   * Simple hash function for objects
   */
  private static hashObject(obj: any): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
