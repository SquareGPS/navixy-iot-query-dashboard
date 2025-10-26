/**
 * Migration Utilities
 * Convert legacy report schemas to Grafana-based format
 */

import type { ReportSchema, TilesRow, TableRow, ChartsRow, AnnotationRow } from '../types/report-schema';
import type { GrafanaDashboard, Panel, GridPosition } from './grafana-dashboard';

export class ReportMigration {
  /**
   * Migrate legacy report schema to Grafana dashboard format
   */
  static migrateToGrafana(legacyReport: ReportSchema): GrafanaDashboard {
    const dashboard: GrafanaDashboard = {
      dashboard: {
        uid: legacyReport.meta.report_id || `report_${Date.now()}`,
        title: legacyReport.title,
        description: legacyReport.subtitle,
        tags: [],
        timezone: 'UTC',
        refresh: '30s',
        time: {
          from: 'now-24h',
          to: 'now'
        },
        templating: {
          list: this.migrateParameters(legacyReport.parameters || [])
        },
        panels: []
      },
      'x-navixy': {
        schemaVersion: '1.0.0',
        execution: {
          endpoint: '/api/sql/execute',
          dialect: 'postgresql',
          timeoutMs: 30000,
          maxRows: 10000,
          readOnly: true,
          allowedSchemas: ['public']
        }
      }
    };

    // Convert rows to panels
    let panelId = 1;
    let currentY = 0;

    legacyReport.rows.forEach((row, rowIndex) => {
      const panels = this.migrateRowToPanels(row, panelId, currentY);
      dashboard.dashboard.panels.push(...panels);
      
      panelId += panels.length;
      currentY += Math.max(...panels.map(p => p.gridPos.h + p.gridPos.y)) + 1;
    });

    return dashboard;
  }

  /**
   * Migrate parameters to Grafana variables
   */
  private static migrateParameters(parameters: any[]): any[] {
    return parameters.map(param => ({
      name: param.name,
      type: this.mapParameterType(param.type),
      label: param.label || param.name,
      description: param.description,
      query: param.allowed ? param.allowed.join(',') : undefined,
      current: {
        text: param.default ? String(param.default) : '',
        value: param.default || ''
      },
      options: param.allowed ? param.allowed.map((val: any) => ({
        text: String(val),
        value: String(val),
        selected: val === param.default
      })) : undefined,
      multi: false,
      includeAll: false,
      hide: 0
    }));
  }

  /**
   * Map legacy parameter types to Grafana variable types
   */
  private static mapParameterType(type: string): string {
    switch (type) {
      case 'enum':
        return 'custom';
      case 'date':
      case 'datetime':
        return 'textbox';
      default:
        return 'textbox';
    }
  }

  /**
   * Migrate a row to one or more panels
   */
  private static migrateRowToPanels(
    row: TilesRow | TableRow | ChartsRow | AnnotationRow,
    startPanelId: number,
    startY: number
  ): Panel[] {
    switch (row.type) {
      case 'tiles':
        return this.migrateTilesRow(row as TilesRow, startPanelId, startY);
      case 'table':
        return this.migrateTableRow(row as TableRow, startPanelId, startY);
      case 'charts':
        return this.migrateChartsRow(row as ChartsRow, startPanelId, startY);
      case 'annotation':
        return this.migrateAnnotationRow(row as AnnotationRow, startPanelId, startY);
      default:
        return [];
    }
  }

  /**
   * Migrate tiles row to KPI panels
   */
  private static migrateTilesRow(row: TilesRow, startPanelId: number, startY: number): Panel[] {
    const panels: Panel[] = [];
    const tilesPerRow = 4; // Assume 4 tiles per row
    const tileWidth = 6; // 24 / 4 = 6 grid units per tile

    row.visuals.forEach((visual, index) => {
      const panelId = startPanelId + index;
      const x = (index % tilesPerRow) * tileWidth;
      const y = startY + Math.floor(index / tilesPerRow) * 4;

      panels.push({
        id: panelId,
        title: visual.label,
        type: 'stat',
        gridPos: { h: 4, w: tileWidth, x, y },
        targets: [],
        fieldConfig: {
          defaults: {
            color: { mode: 'fixed', fixedColor: visual.color || '#3AA3FF' },
            unit: this.mapTileUnit(visual.options),
            decimals: visual.options?.precision || 0
          },
          overrides: []
        },
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
            fields: ''
          },
          orientation: 'auto',
          textMode: 'auto',
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto'
        },
        'x-navixy': {
          sql: {
            statement: visual.query.sql,
            params: this.migrateQueryParams(visual.query.params || {}),
            bindings: this.migrateQueryBindings(visual.query.params || {}),
            limits: {
              timeoutMs: visual.query.timeout_ms || 30000,
              maxRows: 1
            },
            readOnly: true
          },
          dataset: {
            shape: 'kpi',
            columns: {
              value: { type: 'number' }
            }
          },
          verify: {
            min_rows: 1,
            max_rows: 1
          },
          on_empty: 'show_message',
          on_error: 'show_message'
        }
      });
    });

    return panels;
  }

  /**
   * Migrate table row to table panel
   */
  private static migrateTableRow(row: TableRow, startPanelId: number, startY: number): Panel[] {
    const visual = row.visuals[0];
    
    return [{
      id: startPanelId,
      title: visual.label,
      type: 'table',
      gridPos: { h: 8, w: 24, x: 0, y: startY },
      targets: [],
      fieldConfig: {
        defaults: {
          custom: {
            align: 'auto',
            displayMode: 'table',
            filterable: true
          }
        },
        overrides: []
      },
      options: {
        showHeader: true,
        sortBy: [],
        sortDesc: [],
        cellHeight: 'sm',
        footer: {
          show: false,
          reducer: ['sum'],
          fields: ''
        }
      },
      'x-navixy': {
        sql: {
          statement: visual.query.sql,
          params: this.migrateQueryParams(visual.query.params || {}),
          bindings: this.migrateQueryBindings(visual.query.params || {}),
          limits: {
            timeoutMs: visual.query.timeout_ms || 30000,
            maxRows: visual.query.row_limit || 1000
          },
          readOnly: true
        },
        dataset: {
          shape: 'table',
          columns: {} // Will be inferred from query result
        },
        verify: {
          min_rows: 0
        },
        on_empty: 'show_message',
        on_error: 'show_message'
      }
    }];
  }

  /**
   * Migrate charts row to chart panels
   */
  private static migrateChartsRow(row: ChartsRow, startPanelId: number, startY: number): Panel[] {
    const panels: Panel[] = [];
    const chartsPerRow = 2;
    const chartWidth = 12;

    row.visuals.forEach((visual, index) => {
      const panelId = startPanelId + index;
      const x = (index % chartsPerRow) * chartWidth;
      const y = startY + Math.floor(index / chartsPerRow) * 8;

      let panelType: string;
      let options: any;

      if (visual.kind === 'bar') {
        panelType = 'barchart';
        options = {
          orientation: visual.options.orientation || 'vertical',
          showValueLabels: visual.options.show_value_labels || false,
          legend: {
            displayMode: visual.options.show_legend ? 'visible' : 'hidden',
            placement: visual.options.legend_position || 'bottom'
          }
        };
      } else if (visual.kind === 'pie') {
        panelType = 'piechart';
        options = {
          legend: {
            displayMode: visual.options.show_legend ? 'visible' : 'hidden',
            placement: visual.options.legend_position || 'right'
          },
          pieType: visual.options.donut ? 'donut' : 'pie',
          displayLabels: [visual.options.label_type || 'percent']
        };
      } else {
        return; // Skip unsupported chart types
      }

      panels.push({
        id: panelId,
        title: visual.label,
        type: panelType as any,
        gridPos: { h: 8, w: chartWidth, x, y },
        targets: [],
        fieldConfig: {
          defaults: {
            color: { mode: 'palette-classic' },
            custom: {
              hideFrom: {
                legend: false,
                tooltip: false,
                vis: false
              }
            }
          },
          overrides: []
        },
        options,
        'x-navixy': {
          sql: {
            statement: visual.query.sql,
            params: this.migrateQueryParams(visual.query.params || {}),
            bindings: this.migrateQueryBindings(visual.query.params || {}),
            limits: {
              timeoutMs: visual.query.timeout_ms || 30000,
              maxRows: 1000
            },
            readOnly: true
          },
          dataset: {
            shape: visual.kind === 'bar' ? 'category_value' : 'pie',
            columns: {
              [visual.options.category_field]: { type: 'string' },
              [visual.options.value_field]: { type: 'number' }
            }
          },
          verify: {
            min_rows: 1
          },
          transform: this.migrateChartTransforms(visual),
          on_empty: 'show_message',
          on_error: 'show_message'
        }
      });
    });

    return panels;
  }

  /**
   * Migrate annotation row to text panel
   */
  private static migrateAnnotationRow(row: AnnotationRow, startPanelId: number, startY: number): Panel[] {
    const visual = row.visuals[0];
    
    return [{
      id: startPanelId,
      title: visual.label || 'Annotation',
      type: 'text',
      gridPos: { h: 4, w: 24, x: 0, y: startY },
      targets: [],
      fieldConfig: {
        defaults: {},
        overrides: []
      },
      options: {
        mode: 'markdown',
        content: visual.options?.text || '',
        code: {
          language: 'markdown',
          showLineNumbers: false,
          showMiniMap: false
        }
      }
    }];
  }

  /**
   * Migrate query parameters
   */
  private static migrateQueryParams(params: Record<string, any>): Record<string, any> {
    const migrated: Record<string, any> = {};
    
    Object.entries(params).forEach(([name, value]) => {
      migrated[name] = {
        type: this.inferParamType(value),
        default: value
      };
    });

    return migrated;
  }

  /**
   * Migrate query bindings
   */
  private static migrateQueryBindings(params: Record<string, any>): Record<string, string> {
    const bindings: Record<string, string> = {};
    
    Object.keys(params).forEach(name => {
      bindings[name] = `$${name}`;
    });

    return bindings;
  }

  /**
   * Infer parameter type from value
   */
  private static inferParamType(value: any): string {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'int' : 'numeric';
    }
    if (typeof value === 'boolean') {
      return 'bool';
    }
    if (Array.isArray(value)) {
      return 'text[]';
    }
    if (typeof value === 'string' && this.isValidUuid(value)) {
      return 'uuid';
    }
    return 'text';
  }

  /**
   * Map tile unit options
   */
  private static mapTileUnit(options: any): string {
    if (options?.suffix === '%') return 'percent';
    if (options?.suffix === '$') return 'currencyUSD';
    if (options?.suffix === '€') return 'currencyEUR';
    return 'short';
  }

  /**
   * Migrate chart transforms
   */
  private static migrateChartTransforms(visual: any): any[] {
    const transforms: any[] = [];

    if (visual.options.sort_by) {
      transforms.push({
        type: 'sort',
        config: {
          by: visual.options.sort_by,
          dir: visual.options.sort_dir || 'desc'
        }
      });
    }

    if (visual.options.top_n) {
      transforms.push({
        type: 'limit',
        config: {
          n: visual.options.top_n
        }
      });
    }

    return transforms;
  }

  /**
   * Check if string is valid UUID
   */
  private static isValidUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}
