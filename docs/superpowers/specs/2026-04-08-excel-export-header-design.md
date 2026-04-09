# Excel Export Header: Title and Description

## Overview

Allow users to optionally add a report title and description to the top of Excel exports. When enabled, the title is inserted in row 1 and the description in row 2 of the "Data" sheet, and the data table shifts down to start at row 3.

The feature applies to both composite report exports and dashboard panel exports. Settings can be saved in the report/panel configuration and overridden at export time via a dialog.

## Data Model

### ExcelHeaderConfig

```typescript
interface ExcelHeaderConfig {
  enabled: boolean;
  title?: string;
  description?: string;
  column?: string; // column letter, default "A"
}
```

### Storage

- **Composite reports:** `CompositeReportConfig.excelHeader?: ExcelHeaderConfig` - saved with the report config in the database alongside `table`, `chart`, `map`.
- **Dashboard panels:** `Panel.exportConfig?: { excelHeader?: ExcelHeaderConfig }` - saved with the dashboard JSON.

## Backend

### ExcelExportOptions Extension

`backend/src/services/export.ts` — add an optional `excelHeader` field:

```typescript
export interface ExcelExportOptions {
  title: string;
  description?: string | null;
  columns: ExportColumn[];
  rows: unknown[][];
  executedAt: Date;
  excelHeader?: {
    enabled: boolean;
    title?: string;
    description?: string;
    column?: string;
  };
}
```

### generateExcel() Changes

When `excelHeader.enabled === true` and at least one of title/description is non-empty:

1. Insert title in cell `{column}1` with bold, 14pt font. Merge the title cell across the width of the data columns (e.g., A1:F1 if there are 6 data columns) for clean visual appearance.
2. Insert description in cell `{column}2` with italic, 11pt font, gray color. Merge similarly to the title row.
3. Shift the data table to start at row 3: column headers in row 3, data from row 4 onward.
4. Adjust freeze pane from `ySplit: 1` to `ySplit: 3`.
5. Adjust all row references (date formatting loop, auto-fit) to account for the 2-row offset.

When `excelHeader` is absent, disabled, or both title and description are empty, the current behavior is preserved (data starts at row 1).

### Route Changes

- `backend/src/routes/composite-reports.ts`: Extract `excelHeader` from `req.body` and pass to `exportOptions`.
- `backend/src/routes/panels.ts`: Extract `excelHeader` from `req.body` and pass to `exportOptions`.

## Frontend

### Export Dialog Component

New component: `src/components/export/ExportDialog.tsx`

A modal dialog shown when the user clicks an Excel/CSV export action. Contains:

- A toggle switch: "Add report header" (off by default; on if saved config has it enabled).
- When enabled:
  - Title input (text field, pre-filled from saved config or report/panel title).
  - Description input (text area, pre-filled from saved config or report description).
  - Column selector (dropdown: A through Z, default A).
- "Save as default" checkbox to persist these settings to the report/panel config.
- Export button that triggers the download.

When CSV is selected as the format, the header options are disabled with a note that headers apply to Excel (.xlsx) only.

### Integration

- `CompositeReportView.tsx`: Replace direct `handleExportExcel()` calls with opening the ExportDialog. The dialog calls the export API with header options. If "save as default" is checked, PATCH the report config.
- `DashboardRenderer.tsx`: Same pattern for `handleExportPanel()`. If "save as default" is checked, update the panel's `exportConfig` in the dashboard JSON via the existing dashboard save mechanism (the dashboard is already persisted as a JSON blob).

### API Client

`src/services/api.ts`:

- `exportCompositeReportExcel()`: Add optional `excelHeader` to the options and include it in the request body.
- `exportPanelData()`: Add optional `excelHeader` to the options and include it in the request body.

## Edge Cases

- **Empty title and description with header enabled:** Skip header insertion, treat as disabled.
- **Column validation:** Accept single uppercase letters A-Z only; default to "A" on invalid input.
- **CSV export:** Header feature is Excel-only. Dialog grays out header options when CSV format is selected.
- **Freeze pane:** Row 3 when header enabled (title + description + column headers frozen); row 1 when disabled.
- **"Report Info" sheet:** Continues to exist unchanged. Both the Data sheet header and the Report Info sheet may contain the title — they serve different purposes (user-facing vs metadata).

## Files Changed

| File | Change |
|------|--------|
| `backend/src/services/export.ts` | Extend `ExcelExportOptions`, modify `generateExcel()` |
| `backend/src/routes/composite-reports.ts` | Pass `excelHeader` from request body |
| `backend/src/routes/panels.ts` | Pass `excelHeader` from request body |
| `src/services/api.ts` | Extend export method options |
| `src/types/dashboard-types.ts` | Add `ExcelHeaderConfig`, extend `CompositeReportConfig` and `Panel` |
| `src/components/export/ExportDialog.tsx` | New component |
| `src/pages/CompositeReportView.tsx` | Integrate ExportDialog |
| `src/components/reports/DashboardRenderer.tsx` | Integrate ExportDialog |
