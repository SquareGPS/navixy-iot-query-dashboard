/**
 * Panel routes - handles panel-specific operations like export
 */

import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { ExportService } from '../services/export.js';
import { DatabaseService } from '../services/database.js';
import { CustomError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { resolveExportPreferences } from '../services/userPreferences.js';

const router = Router();

// Exports re-run the panel query server-side, so they are allowed far more rows
// than the live panel view (which caps table panels at 10k for client-side
// pagination). 100k matches the composite-report export ceiling; the hard cap
// is a safety bound against an accidental or abusive request.
const EXPORT_DEFAULT_MAX_ROWS = 100000;
const EXPORT_HARD_CAP = 1000000;

/**
 * Resolve the SQL statement timeout from global variables, doubled and floored
 * at 60s for exports — they legitimately run longer than interactive queries.
 * Mirrors the composite-report export path.
 */
function resolveExportTimeoutMs(globalVars: Record<string, string>): number {
  let base = 30000;
  const raw = globalVars.sql_timeout_ms;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) {
      base = parsed;
    }
  }
  return Math.max(base * 2, 60000);
}

/**
 * POST /api/panels/export
 * Export panel data as Excel (xlsx) or CSV.
 *
 * Preferred path: the client sends the panel's resolved `sql` + `params`, and
 * the query is re-run here with a high row cap, then streamed as a file. This
 * avoids shipping the (10k-capped) client rows back in a multi-MB JSON body —
 * which nginx/Express reject with 413 — and lets exports exceed 10k rows.
 *
 * Legacy path: the client sends `columns` + `rows` directly (non-SQL panels).
 */
router.post('/panels/export', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { title, columns, rows, format = 'csv', excelHeader, sql, params, maxRows } = req.body;

    if (format !== 'xlsx' && format !== 'csv') {
      throw new CustomError('format must be "xlsx" or "csv"', 400);
    }

    let exportColumns = columns as { name: string; type: string }[] | undefined;
    let exportRows = rows as unknown[][] | undefined;

    const hasResolvedSql = typeof sql === 'string' && sql.trim().length > 0;

    if (hasResolvedSql) {
      const iotDbUrl = req.user?.iotDbUrl;
      if (!iotDbUrl) {
        throw new CustomError('iotDbUrl is required for export', 400);
      }

      const dbService = DatabaseService.getInstance();

      // Merge global variables (lower priority than explicit params), mirroring
      // /api/sql-new/execute so the export reproduces what the panel displays.
      const mergedParams: Record<string, unknown> =
        params && typeof params === 'object' ? { ...params } : {};
      let globalVars: Record<string, string> = {};
      const userDbUrl = req.user?.userDbUrl;
      if (userDbUrl) {
        try {
          const settingsPool = dbService.getClientSettingsPool(userDbUrl);
          globalVars = await dbService.getGlobalVariablesAsMap(settingsPool);
          for (const [key, value] of Object.entries(globalVars)) {
            if (!(key in mergedParams)) {
              mergedParams[key] = value;
            }
          }
        } catch (err) {
          logger.warn('Panel export: failed to load global variables, continuing without them', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const requestedMaxRows =
        typeof maxRows === 'number' && Number.isFinite(maxRows) && maxRows > 0
          ? Math.floor(maxRows)
          : EXPORT_DEFAULT_MAX_ROWS;
      const exportMaxRows = Math.min(requestedMaxRows, EXPORT_HARD_CAP);
      const timeoutMs = resolveExportTimeoutMs(globalVars);

      const result = await dbService.executeParameterizedQuery(
        sql,
        mergedParams,
        timeoutMs,
        exportMaxRows,
        iotDbUrl,
      );
      exportColumns = result.columns;
      exportRows = result.rows;

      logger.info('Panel export re-queried server-side', {
        title,
        format,
        rowCount: exportRows.length,
        maxRows: exportMaxRows,
        timeoutMs,
      });
    }

    if (!exportColumns || !Array.isArray(exportColumns)) {
      throw new CustomError('columns is required and must be an array', 400);
    }

    if (!exportRows || !Array.isArray(exportRows)) {
      throw new CustomError('rows is required and must be an array', 400);
    }

    const exportPrefs = await resolveExportPreferences(req, req.body);

    const exportService = ExportService.getInstance();
    const exportOptions = {
      title: title || 'Panel Export',
      description: '',
      columns: exportColumns,
      rows: exportRows,
      executedAt: new Date(),
      ...(excelHeader && { excelHeader }),
      ...(exportPrefs.timeZone && { timeZone: exportPrefs.timeZone }),
      ...(exportPrefs.dateFormat && { dateFormat: exportPrefs.dateFormat }),
      ...(exportPrefs.timeFormat && { timeFormat: exportPrefs.timeFormat }),
    };

    if (format === 'csv') {
      const csvBuffer = exportService.generateCSV(exportOptions);
      const filename = `${(title || 'panel').replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', csvBuffer.length);

      res.send(csvBuffer);
    } else {
      const excelBuffer = await exportService.generateExcel(exportOptions);
      const filename = `${(title || 'panel').replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      res.send(excelBuffer);
    }

    logger.info('Panel data exported', { title, format, rowCount: exportRows.length });
  } catch (error) {
    next(error);
  }
});

export default router;
