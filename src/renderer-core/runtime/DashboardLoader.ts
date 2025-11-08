/**
 * Dashboard Loader
 * Parses and validates Grafana Dashboard JSON with Navixy extensions
 */

import type { GrafanaDashboard, Panel } from './grafana-dashboard';
import type { RenderContext, PanelContext, ValidationError } from './runtime-types';

export class DashboardLoader {
  private static readonly SCHEMA_VERSION = "1.0.0";

  /**
   * Parse and validate dashboard JSON
   */
  static parse(json: string): GrafanaDashboard {
    try {
      const parsed = JSON.parse(json);
      return this.validate(parsed);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate dashboard structure
   */
  private static validate(dashboard: any): GrafanaDashboard {
    const errors: ValidationError[] = [];

    // Check required top-level structure
    if (!dashboard.dashboard) {
      errors.push({ code: 'MISSING_DASHBOARD', message: 'Missing required "dashboard" property' });
    }

    if (!dashboard['x-navixy']) {
      errors.push({ code: 'MISSING_NAVIXY', message: 'Missing required "x-navixy" extensions' });
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    // Validate dashboard structure
    this.validateDashboard(dashboard.dashboard, errors);
    this.validateNavixyExtensions(dashboard['x-navixy'], errors);

    if (errors.length > 0) {
      throw new Error(`Dashboard validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    return dashboard as GrafanaDashboard;
  }

  /**
   * Validate dashboard object
   */
  private static validateDashboard(dashboard: any, errors: ValidationError[]): void {
    if (!dashboard.uid) {
      errors.push({ code: 'MISSING_UID', message: 'Dashboard must have a uid' });
    }

    if (!dashboard.title) {
      errors.push({ code: 'MISSING_TITLE', message: 'Dashboard must have a title' });
    }

    if (!dashboard.panels || !Array.isArray(dashboard.panels)) {
      errors.push({ code: 'INVALID_PANELS', message: 'Dashboard must have a panels array' });
    }

    if (!dashboard.time) {
      errors.push({ code: 'MISSING_TIME', message: 'Dashboard must have time configuration' });
    }

    if (!dashboard.templating) {
      errors.push({ code: 'MISSING_TEMPLATING', message: 'Dashboard must have templating configuration' });
    }
  }

  /**
   * Validate Navixy extensions
   */
  private static validateNavixyExtensions(extensions: any, errors: ValidationError[]): void {
    if (!extensions.schemaVersion) {
      errors.push({ code: 'MISSING_SCHEMA_VERSION', message: 'x-navixy must specify schemaVersion' });
    }

    if (!extensions.execution) {
      errors.push({ code: 'MISSING_EXECUTION', message: 'x-navixy must specify execution configuration' });
    }

    if (extensions.execution) {
      if (!extensions.execution.endpoint) {
        errors.push({ code: 'MISSING_ENDPOINT', message: 'Execution must specify endpoint' });
      }

      if (!extensions.execution.dialect) {
        errors.push({ code: 'MISSING_DIALECT', message: 'Execution must specify dialect' });
      }
    }
  }

  /**
   * Build runtime model from validated dashboard
   */
  static buildRuntimeModel(dashboard: GrafanaDashboard): {
    panels: Map<string, PanelContext>;
    context: Partial<RenderContext>;
  } {
    const panels = new Map<string, PanelContext>();
    const context: Partial<RenderContext> = {
      dashboardUid: dashboard.dashboard.uid,
      execution: dashboard['x-navixy'].execution,
    };

    // Index panels
    dashboard.dashboard.panels.forEach((panel: Panel) => {
      const panelId = `panel_${panel.id}`;
      panels.set(panelId, {
        id: panelId,
        panelId: panel.id,
        type: panel.type,
        state: 'idle',
        props: panel.options,
      });
    });

    return { panels, context };
  }

  /**
   * Check if panel has Navixy extensions
   */
  static hasNavixyExtensions(panel: Panel): boolean {
    return !!(panel['x-navixy']?.sql);
  }

  /**
   * Get panel Navixy extensions
   */
  static getNavixyExtensions(panel: Panel) {
    return panel['x-navixy'];
  }
}
