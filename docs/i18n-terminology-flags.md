# i18n — outstanding & non-localizable items

The dashboard/report terminology dichotomy is **resolved and applied** — the rules live
in the keygen guide (`docs/i18n-keygen/README.md`, "Step 6"). What remains are (1)
formatting decisions the devs own, and (2) strings deliberately **not** localized —
recorded here so a future pass doesn't mistake them for i18n gaps. Any genuinely new
terminology question gets appended here.

## Formatting — pending a locale-source decision (devs' scope)

All three hinge on one open question: **which locale drives value formatting — the UI
language (`AppLocaleProvider`) or the separate date/time locale (`DatetimePrefsContext`)?**
None affect the keyed English strings.

- **Month names** — hardcoded English in `src/utils/datetime.ts` (`MONTHS_SHORT` /
  `MONTHS_LONG`, used by the `dd-mmm-yyyy` / `dd-mmmm-yyyy` formats). A ru/es user still
  sees "Jan". Fix: derive from `Intl.DateTimeFormat(locale, { month })`.
- **Number formatting** — inconsistent: `MetricTile.tsx` uses `Intl.NumberFormat('en-US')`;
  panels call bare `value.toLocaleString()`; `ChartSeriesPicker.tsx` passes
  `hiddenCount.toLocaleString()` into a placeholder. Fix: one shared locale-aware helper.
- **Date-range presets** — `DATE_RANGE_PRESETS` (`src/utils/filterVariables.ts`) and the
  `allPresets` array in `ParameterBar.tsx` ("Today", "Yesterday", "Last 7 days"…) are left
  un-keyed pending the same decision; code comments mark both spots.

## Deliberately NOT localized (data / SQL / backend)

- **SQL, not prose** — the SQL-example placeholder in `CompositeReportEditor.tsx`
  (`placeholder="SELECT … FROM …"`), and SQL keywords/statements anywhere.
- **Raw DB error detail** — the `{detail}` interpolated into `errors.sql.*` messages is
  the DB/driver's own text (e.g. Postgres `column "x" does not exist`). Capitalized for
  readability, never translated.
- **SQL result data** — table column headers (author-defined query aliases) and cell
  values, including status values ("parked", "stopped"). Query output, fixed only in the
  SQL. Translating statuses would first need the product to define a fixed status
  vocabulary AND a way to tag status columns — a product decision, not an i18n gap.
- **Dashboard / panel names & Chart Library labels** — sample-dashboard titles and panel
  titles in `schemas/*.json`, and the Chart Library group/preset labels from the DB
  catalog (`useChartPresetCatalog`). Authored content/data, per-deployment.
- **Backend & demo error messages** — `backend/*` messages (iteration 2: error codes) and
  `demoApi.ts`/`demoStorage.ts` thrown messages stay English; keyed at the FE catch-site
  only if displayed.
- **Runtime-data fallbacks** — `'Unknown'` chart-legend group, `'Custom range'` persisted
  variable text (written into stored data). RTL layout is out of scope.
