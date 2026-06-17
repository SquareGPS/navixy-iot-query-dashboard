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
import { resolveExportTimeoutMs, resolvePanelExportMaxRows } from '../utils/exportPolicy.js';

const router = Router();

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
    const { title, columns, rows, format = 'csv', excelHeader, sql, params, maxRows, panelType } = req.body;

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
      const userDbUrl = req.user?.userDbUrl;
      const baseParams: Record<string, unknown> =
        params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
      const { mergedParams, globalVars } = userDbUrl
        ? await dbService.mergeWithGlobalVars(baseParams, dbService.getClientSettingsPool(userDbUrl))
        : { mergedParams: { ...baseParams }, globalVars: {} as Record<string, string> };

      // The per-type row ceiling is server-owned policy; the client only sends
      // the panel type and any per-panel override (verify.max_rows).
      const exportMaxRows = resolvePanelExportMaxRows(
        panelType,
        typeof maxRows === 'number' ? maxRows : undefined,
      );
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

      // Surface truncation: hitting the cap means the export may be incomplete,
      // otherwise a clamped result looks identical to a complete one.
      if (exportRows.length >= exportMaxRows) {
        logger.warn('Panel export hit the row cap; result may be truncated', {
          title,
          rowCount: exportRows.length,
          maxRows: exportMaxRows,
        });
      }

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
