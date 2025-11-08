# Grafana Dashboard Linter Integration Plan

## Overview
Based on the [Grafana Dashboard Linter](https://github.com/grafana/dashboard-linter) and our validation testing, here's how we can integrate dashboard validation into your app.

## ✅ Validation Results

The provided Fleet Status Dashboard schema **passed all validation checks**:
- ✅ Has required title, uid, panels, time config
- ✅ Has proper x-navixy extensions with schema version and execution config
- ✅ All panels have SQL statements and proper configuration
- ✅ Uses supported panel types (kpi, barchart, linechart, piechart, table)
- ✅ Uses parameterized SQL queries
- ✅ Has proper dataset and verification configurations

## 🔧 Integration Approaches

### Option 1: Custom Validator (Recommended)
**Status**: ✅ Implemented and tested

**Benefits**:
- Tailored to your specific needs
- No external dependencies
- Easy to extend with custom rules
- Integrates seamlessly with your TypeScript codebase

**Files Created**:
- `src/utils/grafanaValidator.ts` - Full TypeScript validator
- `test-validator-simple.cjs` - Simple validation test

**Usage**:
```typescript
import { GrafanaDashboardValidator } from './src/utils/grafanaValidator';

const validator = new GrafanaDashboardValidator();
const report = validator.validate(dashboardJson);

if (!report.valid) {
  console.error('Validation errors:', report.errors);
}
```

### Option 2: Official Grafana Linter Integration
**Status**: ⚠️ Requires Go installation

**Benefits**:
- Official Grafana tool
- Comprehensive validation rules
- Active community support

**Challenges**:
- Requires Go runtime
- Currently focused on Prometheus data sources
- Would need extension for your x-navixy format

**Implementation**:
```bash
# Install the official linter
go install github.com/grafana/dashboard-linter@latest

# Validate dashboards
dashboard-linter lint dashboard.json
```

### Option 3: Hybrid Approach
**Status**: 💡 Recommended for production

**Benefits**:
- Best of both worlds
- Use custom validator for immediate needs
- Integrate official linter for comprehensive checks

## 🚀 Implementation Recommendations

### Phase 1: Immediate Integration
1. **Add validator to your app**:
   ```typescript
   // In your report creation/update endpoints
   import { GrafanaDashboardValidator } from '../utils/grafanaValidator';
   
   const validator = new GrafanaDashboardValidator();
   const report = validator.validate(reportSchema);
   
   if (!report.valid) {
     throw new CustomError(`Dashboard validation failed: ${report.errors.map(e => e.message).join(', ')}`, 400);
   }
   ```

2. **Add validation to frontend**:
   ```typescript
   // In your report editor
   const validateDashboard = (schema: string) => {
     const validator = new GrafanaDashboardValidator();
     return validator.validate(schema);
   };
   ```

### Phase 2: Schema Converter
1. **Create Grafana → ReportSchema converter**:
   ```typescript
   export class GrafanaToReportSchemaConverter {
     convert(grafanaDashboard: GrafanaDashboard): ReportSchema {
       // Transform panels to rows
       // Convert x-navixy SQL to Query objects
       // Map panel types to visual types
       // Handle parameter binding
     }
   }
   ```

2. **Add conversion endpoint**:
   ```typescript
   // POST /api/reports/convert-grafana
   router.post('/convert-grafana', async (req, res) => {
     const { grafanaDashboard } = req.body;
     
     // Validate first
     const validator = new GrafanaDashboardValidator();
     const validation = validator.validate(grafanaDashboard);
     
     if (!validation.valid) {
       return res.status(400).json({ error: 'Invalid Grafana dashboard', details: validation.errors });
     }
     
     // Convert to ReportSchema
     const converter = new GrafanaToReportSchemaConverter();
     const reportSchema = converter.convert(grafanaDashboard);
     
     res.json({ reportSchema });
   });
   ```

### Phase 3: Enhanced Features
1. **Add CI/CD integration**:
   ```yaml
   # .github/workflows/validate-dashboards.yml
   - name: Validate Dashboards
     run: |
       node test-validator-simple.cjs
   ```

2. **Add real-time validation**:
   ```typescript
   // In your report editor
   const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
   
   useEffect(() => {
     const validator = new GrafanaDashboardValidator();
     const report = validator.validate(editorValue);
     setValidationReport(report);
   }, [editorValue]);
   ```

## 📊 Current Status

### ✅ Completed
- [x] Custom Grafana dashboard validator implementation
- [x] Validation rules for structure, x-navixy extensions, and panels
- [x] Test validation of provided schema
- [x] Integration plan and recommendations

### 🔄 Next Steps
- [ ] Integrate validator into report creation/update endpoints
- [ ] Add frontend validation in report editor
- [ ] Implement Grafana → ReportSchema converter
- [ ] Add CI/CD validation pipeline
- [ ] Consider official Grafana linter integration

## 🎯 Conclusion

The provided Grafana dashboard schema is **structurally valid** and can be integrated into your app with the right conversion layer. The custom validator we've created provides a solid foundation for validating Grafana-style dashboards before conversion to your ReportSchema format.

**Recommendation**: Start with the custom validator integration (Phase 1), then implement the schema converter (Phase 2) to enable full Grafana dashboard support in your app.
