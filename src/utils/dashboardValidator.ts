/**
 * Dashboard Validator
 * Validates dashboard JSON structure and configuration
 */

export interface ValidationRule {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (dashboard: any) => ValidationResult[];
}

export interface ValidationResult {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  path?: string;
  suggestion?: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationResult[];
  warnings: ValidationResult[];
  info: ValidationResult[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
  };
}

export class DashboardValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * Validate a dashboard JSON
   */
  validate(dashboardJson: string | object): ValidationReport {
    let dashboard: any;
    
    try {
      dashboard = typeof dashboardJson === 'string' 
        ? JSON.parse(dashboardJson) 
        : dashboardJson;
    } catch (error) {
      return {
        valid: false,
        errors: [{
          rule: 'json-parse',
          severity: 'error',
          message: 'Invalid JSON format',
          suggestion: 'Check JSON syntax and formatting'
        }],
        warnings: [],
        info: [],
        summary: { total: 1, errors: 1, warnings: 0, info: 0 }
      };
    }

    const results: ValidationResult[] = [];
    
    // Run all validation rules
    for (const rule of this.rules) {
      try {
        const ruleResults = rule.check(dashboard);
        results.push(...ruleResults);
      } catch (error) {
        results.push({
          rule: rule.name,
          severity: 'error',
          message: `Rule execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          path: 'validation'
        });
      }
    }

    // Categorize results
    const errors = results.filter(r => r.severity === 'error');
    const warnings = results.filter(r => r.severity === 'warning');
    const info = results.filter(r => r.severity === 'info');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
      summary: {
        total: results.length,
        errors: errors.length,
        warnings: warnings.length,
        info: info.length
      }
    };
  }

  /**
   * Initialize validation rules
   */
  private initializeRules(): void {
    // Basic structure rules
    this.rules.push({
      name: 'has-title',
      description: 'Dashboard must have a title',
      severity: 'error',
      check: (dashboard) => {
        if (!dashboard.title) {
          return [{
            rule: 'has-title',
            severity: 'error',
            message: 'Dashboard is missing required "title" field',
            path: 'title',
            suggestion: 'Add a descriptive title for the dashboard'
          }];
        }
        return [];
      }
    });

    this.rules.push({
      name: 'has-uid',
      description: 'Dashboard must have a unique identifier',
      severity: 'error',
      check: (dashboard) => {
        if (!dashboard.uid) {
          return [{
            rule: 'has-uid',
            severity: 'error',
            message: 'Dashboard is missing required "uid" field',
            path: 'uid',
            suggestion: 'Add a unique identifier (e.g., "fleet-status")'
          }];
        }
        return [];
      }
    });

    this.rules.push({
      name: 'has-panels',
      description: 'Dashboard must have panels',
      severity: 'error',
      check: (dashboard) => {
        if (!dashboard.panels || !Array.isArray(dashboard.panels) || dashboard.panels.length === 0) {
          return [{
            rule: 'has-panels',
            severity: 'error',
            message: 'Dashboard must have at least one panel',
            path: 'panels',
            suggestion: 'Add panels to display data visualizations'
          }];
        }
        return [];
      }
    });

    this.rules.push({
      name: 'has-time-config',
      description: 'Dashboard must have time configuration',
      severity: 'error',
      check: (dashboard) => {
        if (!dashboard.time) {
          return [{
            rule: 'has-time-config',
            severity: 'error',
            message: 'Dashboard is missing time configuration',
            path: 'time',
            suggestion: 'Add time range configuration (e.g., {"from": "now-24h", "to": "now"})'
          }];
        }
        return [];
      }
    });

    // Navixy extensions rules
    this.rules.push({
      name: 'has-navixy-extensions',
      description: 'Dashboard must have x-navixy extensions',
      severity: 'error',
      check: (dashboard) => {
        if (!dashboard['x-navixy']) {
          return [{
            rule: 'has-navixy-extensions',
            severity: 'error',
            message: 'Dashboard is missing required "x-navixy" extensions',
            path: 'x-navixy',
            suggestion: 'Add Navixy extensions for SQL execution configuration'
          }];
        }
        return [];
      }
    });

    this.rules.push({
      name: 'navixy-schema-version',
      description: 'x-navixy must specify schema version',
      severity: 'error',
      check: (dashboard) => {
        if (dashboard['x-navixy'] && !dashboard['x-navixy'].schemaVersion) {
          return [{
            rule: 'navixy-schema-version',
            severity: 'error',
            message: 'x-navixy must specify schemaVersion',
            path: 'x-navixy.schemaVersion',
            suggestion: 'Add schemaVersion field (e.g., "1.0.0")'
          }];
        }
        return [];
      }
    });

    this.rules.push({
      name: 'navixy-execution-config',
      description: 'x-navixy must have execution configuration',
      severity: 'error',
      check: (dashboard) => {
        if (dashboard['x-navixy'] && !dashboard['x-navixy'].execution) {
          return [{
            rule: 'navixy-execution-config',
            severity: 'error',
            message: 'x-navixy must specify execution configuration',
            path: 'x-navixy.execution',
            suggestion: 'Add execution config with endpoint, dialect, timeout, etc.'
          }];
        }
        return [];
      }
    });

    // Panel validation rules
    this.rules.push({
      name: 'panel-has-navixy-sql',
      description: 'Panels with x-navixy must have SQL configuration',
      severity: 'error',
      check: (dashboard) => {
        const results: ValidationResult[] = [];
        
        if (dashboard.panels) {
          dashboard.panels.forEach((panel: any, index: number) => {
            if (panel['x-navixy'] && !panel['x-navixy'].sql) {
              results.push({
                rule: 'panel-has-navixy-sql',
                severity: 'error',
                message: `Panel "${panel.title || index}" has x-navixy but no SQL configuration`,
                path: `panels[${index}].x-navixy.sql`,
                suggestion: 'Add SQL statement and parameter configuration'
              });
            }
          });
        }
        
        return results;
      }
    });

    this.rules.push({
      name: 'panel-sql-has-statement',
      description: 'SQL configuration must have statement',
      severity: 'error',
      check: (dashboard) => {
        const results: ValidationResult[] = [];
        
        if (dashboard.panels) {
          dashboard.panels.forEach((panel: any, index: number) => {
            if (panel['x-navixy']?.sql && !panel['x-navixy'].sql.statement) {
              results.push({
                rule: 'panel-sql-has-statement',
                severity: 'error',
                message: `Panel "${panel.title || index}" SQL configuration missing statement`,
                path: `panels[${index}].x-navixy.sql.statement`,
                suggestion: 'Add SQL query statement'
              });
            }
          });
        }
        
        return results;
      }
    });

    // Best practices rules
    this.rules.push({
      name: 'panel-has-title',
      description: 'All panels should have descriptive titles',
      severity: 'warning',
      check: (dashboard) => {
        const results: ValidationResult[] = [];
        
        if (dashboard.panels) {
          dashboard.panels.forEach((panel: any, index: number) => {
            if (!panel.title || panel.title.trim().length === 0) {
              results.push({
                rule: 'panel-has-title',
                severity: 'warning',
                message: `Panel ${index} should have a descriptive title`,
                path: `panels[${index}].title`,
                suggestion: 'Add a clear, descriptive title for the panel'
              });
            }
          });
        }
        
        return results;
      }
    });

    this.rules.push({
      name: 'panel-has-gridpos',
      description: 'All panels should have grid position',
      severity: 'warning',
      check: (dashboard) => {
        const results: ValidationResult[] = [];
        
        if (dashboard.panels) {
          dashboard.panels.forEach((panel: any, index: number) => {
            if (!panel.gridPos) {
              results.push({
                rule: 'panel-has-gridpos',
                severity: 'warning',
                message: `Panel "${panel.title || index}" should have grid position`,
                path: `panels[${index}].gridPos`,
                suggestion: 'Add gridPos with x, y, w, h coordinates'
              });
            }
          });
        }
        
        return results;
      }
    });

    // SQL-specific rules
    this.rules.push({
      name: 'sql-uses-parameters',
      description: 'SQL should use parameterized queries',
      severity: 'warning',
      check: (dashboard) => {
        const results: ValidationResult[] = [];
        
        if (dashboard.panels) {
          dashboard.panels.forEach((panel: any, index: number) => {
            const sql = panel['x-navixy']?.sql?.statement;
            if (sql && !sql.includes(':')) {
              results.push({
                rule: 'sql-uses-parameters',
                severity: 'warning',
                message: `Panel "${panel.title || index}" SQL should use parameterized queries`,
                path: `panels[${index}].x-navixy.sql.statement`,
                suggestion: 'Use :parameter_name syntax instead of string concatenation'
              });
            }
          });
        }
        
        return results;
      }
    });
  }

  /**
   * Add a custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Get all available rules
   */
  getRules(): ValidationRule[] {
    return [...this.rules];
  }
}

/**
 * Utility function to validate a dashboard file
 */
export async function validateDashboardFile(filePath: string): Promise<ValidationReport> {
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    const validator = new DashboardValidator();
    return validator.validate(content);
  } catch (error) {
    return {
      valid: false,
      errors: [{
        rule: 'file-read',
        severity: 'error',
        message: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: filePath
      }],
      warnings: [],
      info: [],
      summary: { total: 1, errors: 1, warnings: 0, info: 0 }
    };
  }
}
