/**
 * Panel routes - handles panel-specific operations like export
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ExportService } from '../services/export.js';
import { CustomError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/panels/export
 * Export panel data as Excel (xlsx) or CSV
 */
router.post('/panels/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, columns, rows, format = 'csv' } = req.body;

    if (!columns || !Array.isArray(columns)) {
      throw new CustomError('columns is required and must be an array', 400);
    }

    if (!rows || !Array.isArray(rows)) {
      throw new CustomError('rows is required and must be an array', 400);
    }

    if (format !== 'xlsx' && format !== 'csv') {
      throw new CustomError('format must be "xlsx" or "csv"', 400);
    }

    const exportService = ExportService.getInstance();
    const exportOptions = {
      title: title || 'Panel Export',
      description: '',
      columns: columns as { name: string; type: string }[],
      rows: rows as unknown[][],
      executedAt: new Date(),
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

    logger.info('Panel data exported', { title, format, rowCount: rows.length });
  } catch (error) {
    next(error);
  }
});

export default router;
