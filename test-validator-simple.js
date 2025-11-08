/**
 * Simple Grafana Dashboard Validator Test
 * Tests the provided schema against validation rules
 */

const fs = require('fs');

// Simple validation rules
const validationRules = [
  {
    name: 'has-title',
    check: (dashboard) => !dashboard.title ? 'Missing required "title" field' : null
  },
  {
    name: 'has-uid', 
    check: (dashboard) => !dashboard.uid ? 'Missing required "uid" field' : null
  },
  {
    name: 'has-panels',
    check: (dashboard) => !dashboard.panels || !Array.isArray(dashboard.panels) || dashboard.panels.length === 0 ? 'Must have at least one panel' : null
  },
  {
    name: 'has-time-config',
    check: (dashboard) => !dashboard.time ? 'Missing time configuration' : null
  },
  {
    name: 'has-navixy-extensions',
    check: (dashboard) => !dashboard['x-navixy'] ? 'Missing required "x-navixy" extensions' : null
  },
  {
    name: 'navixy-schema-version',
    check: (dashboard) => dashboard['x-navixy'] && !dashboard['x-navixy'].schemaVersion ? 'x-navixy must specify schemaVersion' : null
  },
  {
    name: 'navixy-execution-config',
    check: (dashboard) => dashboard['x-navixy'] && !dashboard['x-navixy'].execution ? 'x-navixy must specify execution configuration' : null
  },
  {
    name: 'panel-has-navixy-sql',
    check: (dashboard) => {
      const errors = [];
      if (dashboard.panels) {
        dashboard.panels.forEach((panel, index) => {
          if (panel['x-navixy'] && !panel['x-navixy'].sql) {
            errors.push(`Panel "${panel.title || index}" has x-navixy but no SQL configuration`);
          }
        });
      }
      return errors.length > 0 ? errors.join('; ') : null;
    }
  },
  {
    name: 'panel-sql-has-statement',
    check: (dashboard) => {
      const errors = [];
      if (dashboard.panels) {
        dashboard.panels.forEach((panel, index) => {
          if (panel['x-navixy']?.sql && !panel['x-navixy'].sql.statement) {
            errors.push(`Panel "${panel.title || index}" SQL configuration missing statement`);
          }
        });
      }
      return errors.length > 0 ? errors.join('; ') : null;
    }
  }
];

// Warning rules
const warningRules = [
  {
    name: 'panel-has-title',
    check: (dashboard) => {
      const warnings = [];
      if (dashboard.panels) {
        dashboard.panels.forEach((panel, index) => {
          if (!panel.title || panel.title.trim().length === 0) {
            warnings.push(`Panel ${index} should have a descriptive title`);
          }
        });
      }
      return warnings.length > 0 ? warnings.join('; ') : null;
    }
  },
  {
    name: 'panel-has-gridpos',
    check: (dashboard) => {
      const warnings = [];
      if (dashboard.panels) {
        dashboard.panels.forEach((panel, index) => {
          if (!panel.gridPos) {
            warnings.push(`Panel "${panel.title || index}" should have grid position`);
          }
        });
      }
      return warnings.length > 0 ? warnings.join('; ') : null;
    }
  },
  {
    name: 'sql-uses-parameters',
    check: (dashboard) => {
      const warnings = [];
      if (dashboard.panels) {
        dashboard.panels.forEach((panel, index) => {
          const sql = panel['x-navixy']?.sql?.statement;
          if (sql && !sql.includes(':')) {
            warnings.push(`Panel "${panel.title || index}" SQL should use parameterized queries`);
          }
        });
      }
      return warnings.length > 0 ? warnings.join('; ') : null;
    }
  }
];

function validateDashboard(dashboard) {
  const errors = [];
  const warnings = [];

  // Run error rules
  validationRules.forEach(rule => {
    const result = rule.check(dashboard);
    if (result) {
      errors.push({ rule: rule.name, message: result });
    }
  });

  // Run warning rules
  warningRules.forEach(rule => {
    const result = rule.check(dashboard);
    if (result) {
      warnings.push({ rule: rule.name, message: result });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      total: errors.length + warnings.length,
      errors: errors.length,
      warnings: warnings.length
    }
  };
}

function main() {
  console.log('🔍 Grafana Dashboard Validator Test');
  console.log('=====================================\n');

  try {
    // Read the test dashboard file
    const dashboardContent = fs.readFileSync('./test-fleet-dashboard.json', 'utf-8');
    const dashboard = JSON.parse(dashboardContent);

    console.log('📊 Validating Fleet Status Dashboard...\n');

    // Validate the dashboard
    const report = validateDashboard(dashboard);

    // Display results
    console.log('📋 Validation Report');
    console.log('===================');
    console.log(`✅ Valid: ${report.valid ? 'YES' : 'NO'}`);
    console.log(`📊 Summary: ${report.summary.total} total issues`);
    console.log(`   ❌ Errors: ${report.summary.errors}`);
    console.log(`   ⚠️  Warnings: ${report.summary.warnings}\n`);

    // Display errors
    if (report.errors.length > 0) {
      console.log('❌ ERRORS:');
      report.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. [${error.rule}] ${error.message}`);
      });
      console.log('');
    }

    // Display warnings
    if (report.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      report.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. [${warning.rule}] ${warning.message}`);
      });
      console.log('');
    }

    console.log('🎯 Conclusion:');
    if (report.valid) {
      console.log('✅ The dashboard schema is structurally valid!');
      console.log('💡 However, it still needs conversion to your app\'s ReportSchema format.');
    } else {
      console.log('❌ The dashboard schema has validation errors that need to be fixed.');
    }

    console.log('\n📝 Integration Recommendations:');
    console.log('1. Use this validator to check Grafana dashboards before conversion');
    console.log('2. Implement a schema converter to transform valid Grafana dashboards');
    console.log('3. Add this validation to your CI/CD pipeline');
    console.log('4. Consider extending the Grafana Dashboard Linter for your specific needs');

  } catch (error) {
    console.error('❌ Error running validation:', error.message);
    process.exit(1);
  }
}

// Run the test
main();
