import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../services/database.js';
import { ExportService } from '../services/export.js';
import { authenticateToken, requireAdminOrEditor } from '../middleware/auth.js';
import { CustomError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { detectGPSColumns, validateGPSData, extractGPSPoints, suggestLabelColumn, type ColumnInfo } from '../utils/gpsDetection.js';

const router = Router();

// Helper to extract user info from request
function getUserInfo(req: Request): { userDbUrl: string; userId: string; iotDbUrl?: string; sessionId?: string } {
  const user = (req as any).user;
  const userDbUrl = user?.userDbUrl;
  const userId = user?.userId;
  const iotDbUrl = user?.iotDbUrl;
  const sessionId = user?.session_id;

  if (!userDbUrl || typeof userDbUrl !== 'string') {
    throw new CustomError('User database URL not configured', 400);
  }

  if (!userId || typeof userId !== 'string') {
    throw new CustomError('User ID not found', 400);
  }

  return { userDbUrl, userId, iotDbUrl, sessionId };
}

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/composite-reports
 * List all composite reports for the authenticated user
 */
router.get('/composite-reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userDbUrl, userId } = getUserInfo(req);

    const dbService = DatabaseService.getInstance();
    const pool = dbService.getClientSettingsPool(userDbUrl);
    const compositeReports = await dbService.getCompositeReports(pool, userId);

    res.json({
      success: true,
      data: compositeReports,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/composite-reports/:id
 * Get a single composite report by ID
 */
router.get('/composite-reports/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (!id) {
      throw new CustomError('Report ID is required', 400);
    }
    const { userDbUrl, userId } = getUserInfo(req);

    const dbService = DatabaseService.getInstance();
    const pool = dbService.getClientSettingsPool(userDbUrl);
    const compositeReport = await dbService.getCompositeReportById(id, pool, userId);

    if (!compositeReport) {
      throw new CustomError('Composite report not found', 404);
    }

    res.json({
      success: true,
      data: compositeReport,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/composite-reports
 * Create a new composite report
 */
router.post('/composite-reports', requireAdminOrEditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, slug, section_id, sort_order, sql_query, config, report_schema } = req.body;
    const { userDbUrl, userId } = getUserInfo(req);

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new CustomError('Title is required', 400);
    }

    if (!sql_query || typeof sql_query !== 'string' || sql_query.trim().length === 0) {
      throw new CustomError('SQL query is required', 400);
    }

    // Generate slug if not provided
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Default config if not provided
    const defaultConfig = {
      table: { enabled: true, pageSize: 50, showTotals: false },
      chart: { enabled: true, type: 'timeseries', xColumn: '', yColumns: [] },
      map: { enabled: false, autoDetect: true },
    };

    const finalConfig = config ? { ...defaultConfig, ...config } : defaultConfig;

    const dbService = DatabaseService.getInstance();
    const pool = dbService.getClientSettingsPool(userDbUrl);
    
    const compositeReport = await dbService.createCompositeReport({
      title: title.trim(),
      description: description?.trim() || null,
      slug: finalSlug,
      section_id: section_id || null,
      sort_order: sort_order || 0,
      sql_query: sql_query.trim(),
      config: finalConfig,
      report_schema: report_schema || null,
      user_id: userId,
      created_by: userId,
    }, pool);

    logger.info('Created composite report', { id: compositeReport.id, title, userId });

    res.status(201).json({
      success: true,
      data: compositeReport,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/composite-reports/:id
 * Update an existing composite report
 */
router.put('/composite-reports/:id', requireAdminOrEditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (!id) {
      throw new CustomError('Report ID is required', 400);
    }
    const { title, description, slug, section_id, sort_order, sql_query, config, report_schema } = req.body;
    const { userDbUrl, userId } = getUserInfo(req);

    const dbService = DatabaseService.getInstance();
    const pool = dbService.getClientSettingsPool(userDbUrl);
    
    const compositeReport = await dbService.updateCompositeReport(id, {
      title: title?.trim(),
      description: description?.trim(),
      slug,
      section_id,
      sort_order,
      sql_query: sql_query?.trim(),
      config,
      report_schema,
      updated_by: userId,
    }, pool, userId);

    logger.info('Updated composite report', { id, userId });

    res.json({
      success: true,
      data: compositeReport,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/composite-reports/:id
 * Soft delete a composite report
 */
router.delete('/composite-reports/:id', requireAdminOrEditor, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (!id) {
      throw new CustomError('Report ID is required', 400);
    }
    const { userDbUrl, userId } = getUserInfo(req);

    const dbService = DatabaseService.getInstance();
    const pool = dbService.getClientSettingsPool(userDbUrl);
    
    await dbService.deleteCompositeReport(id, pool, userId);

    logger.info('Deleted composite report', { id, userId });

    res.json({
      success: true,
      message: 'Composite report deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/composite-reports/:id/execute
 * Execute the SQL query for a composite report and return data
 */
router.post('/composite-reports/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (!id) {
      throw new CustomError('Report ID is required', 400);
    }
    const { page = 1, pageSize = 1000, params = {} } = req.body;
    const { userDbUrl, userId, iotDbUrl } = getUserInfo(req);

    if (!iotDbUrl) {
      throw new CustomError('IoT database URL not configured', 400);
    }

    const dbService = DatabaseService.getInstance();
    const pool = dbService.getClientSettingsPool(userDbUrl);
    
    // Get the composite report
    const compositeReport = await dbService.getCompositeReportById(id, pool, userId);
    if (!compositeReport) {
      throw new CustomError('Composite report not found', 404);
    }

    // Check if SQL query is valid
    const sqlQuery = compositeReport.sql_query?.trim();
    if (!sqlQuery) {
      // Return empty result for empty query
      res.json({
        success: true,
        data: {
          columns: [],
          rows: [],
          stats: { rowCount: 0, executionTime: 0 },
          pagination: { page, pageSize, total: 0, totalPages: 0 },
          gps: null,
          message: 'No SQL query configured for this report',
        },
      });
      return;
    }

    // Get global variables for parameter substitution
    const globalVariables = await dbService.getGlobalVariablesAsMap(pool);
    
    // Merge global variables with provided params
    const mergedParams = { ...globalVariables, ...params };

    // Execute the SQL query
    let result;
    try {
      result = await dbService.executeParameterizedQuery(
        sqlQuery,
        mergedParams,
        30000, // 30 second timeout
        10000, // max 10000 rows
        iotDbUrl,
        { page, pageSize }
      );
    } catch (queryError: any) {
      // Return empty result with error message for SQL errors
      logger.warn('Composite report SQL execution failed:', queryError.message);
      res.json({
        success: true,
        data: {
          columns: [],
          rows: [],
          stats: { rowCount: 0, executionTime: 0 },
          pagination: { page, pageSize, total: 0, totalPages: 0 },
          gps: null,
          error: queryError.message,
          message: 'Query execution failed',
        },
      });
      return;
    }

    // Convert column info for GPS detection
    const columnInfo: ColumnInfo[] = result.columns.map(col => ({
      name: col.name,
      type: col.type,
    }));

    // Auto-detect GPS columns if enabled
    let gpsInfo = null;
    const mapConfig = compositeReport.config?.map;
    if (mapConfig?.enabled) {
      if (mapConfig.autoDetect) {
        const detectedGPS = detectGPSColumns(columnInfo);
        if (detectedGPS) {
          // Convert row arrays to objects for validation
          const rowObjects = result.rows.map((row: unknown[]) => {
            const obj: Record<string, any> = {};
            result.columns.forEach((col, idx) => {
              obj[col.name] = row[idx];
            });
            return obj;
          });

          if (validateGPSData(rowObjects, detectedGPS)) {
            const labelColumn = suggestLabelColumn(columnInfo);
            gpsInfo = {
              ...detectedGPS,
              labelColumn,
              hasValidData: true,
              pointCount: extractGPSPoints(rowObjects, detectedGPS).length,
            };
          }
        }
      } else if (mapConfig.latColumn && mapConfig.lonColumn) {
        gpsInfo = {
          latColumn: mapConfig.latColumn,
          lonColumn: mapConfig.lonColumn,
          labelColumn: mapConfig.labelColumn,
          hasValidData: true,
        };
      }
    }

    res.json({
      success: true,
      data: {
        columns: result.columns,
        rows: result.rows,
        stats: result.stats,
        pagination: result.pagination,
        gps: gpsInfo,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/composite-reports/:id/detect-columns
 * Detect columns from the SQL query (for configuration UI)
 */
router.post('/composite-reports/:id/detect-columns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (!id) {
      throw new CustomError('Report ID is required', 400);
    }
    const { userDbUrl, userId, iotDbUrl } = getUserInfo(req);

    if (!iotDbUrl) {
      throw new CustomError('IoT database URL not configured', 400);
    }

    const dbService = DatabaseService.getInstance();
    const pool = dbService.getClientSettingsPool(userDbUrl);
    
    // Get the composite report
    const compositeReport = await dbService.getCompositeReportById(id, pool, userId);
    if (!compositeReport) {
      throw new CustomError('Composite report not found', 404);
    }

    // Execute query with limit 1 to get column info
    const result = await dbService.executeParameterizedQuery(
      compositeReport.sql_query,
      {},
      10000,
      1,
      iotDbUrl
    );

    const columnInfo: ColumnInfo[] = result.columns.map(col => ({
      name: col.name,
      type: col.type,
    }));

    // Detect GPS columns
    const gpsColumns = detectGPSColumns(columnInfo);
    const labelColumn = suggestLabelColumn(columnInfo);

    // Suggest chart columns (numeric columns for Y, timestamp/date for X)
    const numericColumns = columnInfo.filter(col => 
      ['real', 'double precision', 'numeric', 'integer', 'bigint', 'smallint'].some(t => col.type.includes(t))
    );
    const timeColumns = columnInfo.filter(col =>
      ['timestamp', 'date', 'time'].some(t => col.type.includes(t))
    );

    res.json({
      success: true,
      data: {
        columns: columnInfo,
        suggestions: {
          gps: gpsColumns,
          labelColumn,
          xColumn: timeColumns[0]?.name || columnInfo[0]?.name,
          yColumns: numericColumns.slice(0, 3).map(c => c.name),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper function to apply geocoded addresses to data
 * Replaces lat/lon columns with a single Address column
 */
function applyGeocodedAddresses(
  columns: { name: string; type: string }[],
  rows: unknown[][],
  geocodedAddresses: Record<string, string> | undefined,
  latColumn: string | undefined,
  lonColumn: string | undefined
): { columns: { name: string; type: string }[]; rows: unknown[][] } {
  if (!geocodedAddresses || !latColumn || !lonColumn || Object.keys(geocodedAddresses).length === 0) {
    return { columns, rows };
  }

  const latIdx = columns.findIndex(c => c.name === latColumn);
  const lonIdx = columns.findIndex(c => c.name === lonColumn);

  if (latIdx === -1 || lonIdx === -1) {
    return { columns, rows };
  }

  // Create new columns: replace lat column with Address, remove lon column
  const newColumns = columns
    .map((col, idx) => {
      if (idx === latIdx) {
        return { name: 'Address', type: 'text' };
      }
      if (idx === lonIdx) {
        return null; // Remove lon column
      }
      return col;
    })
    .filter((col): col is { name: string; type: string } => col !== null);

  // Transform rows
  const newRows = rows.map(row => {
    const lat = parseFloat(String(row[latIdx]));
    const lng = parseFloat(String(row[lonIdx]));
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const address = geocodedAddresses[key] || `${lat}, ${lng}`;

    return row
      .map((cell, idx) => {
        if (idx === latIdx) {
          return address;
        }
        if (idx === lonIdx) {
          return null; // Remove lon value
        }
        return cell;
      })
      .filter((_, idx) => idx !== lonIdx);
  });

  return { columns: newColumns, rows: newRows };
}

/**
 * POST /api/composite-reports/:id/export/excel
 * Export composite report data as Excel (xlsx) or CSV file
 */
router.post('/composite-reports/:id/export/excel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (!id) {
      throw new CustomError('Report ID is required', 400);
    }
    const { params = {}, geocodedAddresses, latColumn, lonColumn, format = 'xlsx' } = req.body;
    const { userDbUrl, userId, iotDbUrl } = getUserInfo(req);

    if (!iotDbUrl) {
      throw new CustomError('IoT database URL not configured', 400);
    }

    // Validate format
    if (format !== 'xlsx' && format !== 'csv') {
      throw new CustomError('Invalid format. Must be "xlsx" or "csv"', 400);
    }

    const dbService = DatabaseService.getInstance();
    const pool = dbService.getClientSettingsPool(userDbUrl);
    
    // Get the composite report
    const compositeReport = await dbService.getCompositeReportById(id, pool, userId);
    if (!compositeReport) {
      throw new CustomError('Composite report not found', 404);
    }

    // Get global variables
    const globalVariables = await dbService.getGlobalVariablesAsMap(pool);
    const mergedParams = { ...globalVariables, ...params };

    // Execute query to get all data (no pagination for export)
    const result = await dbService.executeParameterizedQuery(
      compositeReport.sql_query,
      mergedParams,
      60000, // 60 second timeout for export
      100000, // Allow more rows for export
      iotDbUrl
    );

    // Apply geocoded addresses if provided
    const { columns, rows } = applyGeocodedAddresses(
      result.columns,
      result.rows,
      geocodedAddresses,
      latColumn,
      lonColumn
    );

    const exportService = ExportService.getInstance();
    const exportOptions = {
      title: compositeReport.title,
      description: compositeReport.description,
      columns,
      rows,
      executedAt: new Date(),
    };

    if (format === 'csv') {
      // Generate CSV file
      const csvBuffer = exportService.generateCSV(exportOptions);

      const filename = `${compositeReport.slug || 'composite-report'}-${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', csvBuffer.length);

      res.send(csvBuffer);
    } else {
      // Generate Excel file (default)
      const excelBuffer = await exportService.generateExcel(exportOptions);

      const filename = `${compositeReport.slug || 'composite-report'}-${Date.now()}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      res.send(excelBuffer);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/composite-reports/:id/export/html
 * Export composite report as self-contained HTML
 */
router.post('/composite-reports/:id/export/html', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (!id) {
      throw new CustomError('Report ID is required', 400);
    }
    const { params = {}, includeChart = true, includeMap = true, geocodedAddresses, latColumn, lonColumn, chartSettings, mapSettings } = req.body;
    const { userDbUrl, userId, iotDbUrl } = getUserInfo(req);

    if (!iotDbUrl) {
      throw new CustomError('IoT database URL not configured', 400);
    }

    const dbService = DatabaseService.getInstance();
    const pool = dbService.getClientSettingsPool(userDbUrl);
    
    // Get the composite report
    const compositeReport = await dbService.getCompositeReportById(id, pool, userId);
    if (!compositeReport) {
      throw new CustomError('Composite report not found', 404);
    }

    // Get global variables
    const globalVariables = await dbService.getGlobalVariablesAsMap(pool);
    const mergedParams = { ...globalVariables, ...params };

    // Execute query
    const result = await dbService.executeParameterizedQuery(
      compositeReport.sql_query,
      mergedParams,
      60000,
      10000,
      iotDbUrl
    );

    // Apply geocoded addresses if provided
    const { columns, rows } = applyGeocodedAddresses(
      result.columns,
      result.rows,
      geocodedAddresses,
      latColumn,
      lonColumn
    );

    // Detect GPS columns for map (use original columns, not geocoded ones for map functionality)
    const columnInfo: ColumnInfo[] = result.columns.map(col => ({
      name: col.name,
      type: col.type,
    }));
    const gpsColumns = compositeReport.config?.map?.autoDetect 
      ? detectGPSColumns(columnInfo)
      : compositeReport.config?.map?.latColumn && compositeReport.config?.map?.lonColumn
        ? { latColumn: compositeReport.config.map.latColumn, lonColumn: compositeReport.config.map.lonColumn }
        : null;

    // Generate HTML (use geocoded data for table, but original for map)
    const exportService = ExportService.getInstance();
    const html = await exportService.generateHTML({
      title: compositeReport.title,
      description: compositeReport.description,
      columns,
      rows,
      config: compositeReport.config,
      gpsColumns: includeMap && !geocodedAddresses ? gpsColumns : null, // Don't show map if geocoded (lat/lon removed)
      includeChart,
      executedAt: new Date(),
      chartSettings, // Pass chart settings from frontend
      mapSettings, // Pass map view state from frontend
    });

    // Set response headers
    const filename = `${compositeReport.slug || 'composite-report'}-${Date.now()}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(html);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/composite-reports/:id/export/pdf
 * Export composite report as PDF
 */
router.post('/composite-reports/:id/export/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    if (!id) {
      throw new CustomError('Report ID is required', 400);
    }
    const { params = {}, includeChart = true, includeMap = true, geocodedAddresses, latColumn, lonColumn, chartSettings, mapSettings } = req.body;
    const { userDbUrl, userId, iotDbUrl } = getUserInfo(req);

    if (!iotDbUrl) {
      throw new CustomError('IoT database URL not configured', 400);
    }

    const dbService = DatabaseService.getInstance();
    const pool = dbService.getClientSettingsPool(userDbUrl);
    
    // Get the composite report
    const compositeReport = await dbService.getCompositeReportById(id, pool, userId);
    if (!compositeReport) {
      throw new CustomError('Composite report not found', 404);
    }

    // Get global variables
    const globalVariables = await dbService.getGlobalVariablesAsMap(pool);
    const mergedParams = { ...globalVariables, ...params };

    // Execute query
    const result = await dbService.executeParameterizedQuery(
      compositeReport.sql_query,
      mergedParams,
      60000,
      10000,
      iotDbUrl
    );

    // Apply geocoded addresses if provided
    const { columns, rows } = applyGeocodedAddresses(
      result.columns,
      result.rows,
      geocodedAddresses,
      latColumn,
      lonColumn
    );

    // Detect GPS columns for map (use original columns, not geocoded ones for map functionality)
    const columnInfo: ColumnInfo[] = result.columns.map(col => ({
      name: col.name,
      type: col.type,
    }));
    const gpsColumns = compositeReport.config?.map?.autoDetect 
      ? detectGPSColumns(columnInfo)
      : compositeReport.config?.map?.latColumn && compositeReport.config?.map?.lonColumn
        ? { latColumn: compositeReport.config.map.latColumn, lonColumn: compositeReport.config.map.lonColumn }
        : null;

    // Generate HTML first (use geocoded data for table, but original for map)
    const exportService = ExportService.getInstance();
    const html = await exportService.generateHTML({
      title: compositeReport.title,
      description: compositeReport.description,
      columns,
      rows,
      config: compositeReport.config,
      gpsColumns: includeMap && !geocodedAddresses ? gpsColumns : null, // Don't show map if geocoded (lat/lon removed)
      includeChart,
      executedAt: new Date(),
      chartSettings, // Pass chart settings from frontend
      mapSettings, // Pass map view state from frontend
    });

    // Convert HTML to PDF
    const pdfBuffer = await exportService.generatePDF(html);

    logger.info('Exported composite report to PDF', { id, userId, size: pdfBuffer.length });

    // Set response headers
    const filename = `${compositeReport.slug || 'composite-report'}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// Geocoding cache TTL: 30 days (addresses don't change often)
const GEOCODE_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Generate cache key for geocoding
 */
function getGeocodeCacheKey(lat: number, lng: number): string {
  // Round to 6 decimal places for consistent cache keys
  return `geocode:${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * POST /api/composite-reports/geocode
 * Geocode coordinates to address using Navixy API
 */
router.post('/composite-reports/geocode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.body;
    const { sessionId } = getUserInfo(req);

    if (!sessionId) {
      throw new CustomError('Session ID (hash) is required for geocoding', 400);
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new CustomError('Invalid coordinates: lat and lng must be numbers', 400);
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new CustomError('Invalid coordinates: lat must be between -90 and 90, lng between -180 and 180', 400);
    }

    // Check Redis cache first
    const cacheKey = getGeocodeCacheKey(lat, lng);
    const redisService = (await import('../services/redis.js')).RedisService.getInstance();
    const cachedAddress = await redisService.get(cacheKey);
    
    if (cachedAddress !== null) {
      logger.debug('Geocode cache hit', { lat, lng });
      res.json({
        success: true,
        address: cachedAddress,
        cached: true,
      });
      return;
    }

    const response = await fetch('https://api.eu.navixy.com/v2/geocoder/search_location', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hash: sessionId,
        location: {
          lat,
          lng,
        },
      }),
    });

    if (!response.ok) {
      throw new CustomError(`Geocoder API error: ${response.status}`, 502);
    }

    const data = await response.json();

    if (!data.success) {
      throw new CustomError('Geocoding failed', 502);
    }

    const address = data.value || null;

    // Cache the result if we got an address
    if (address) {
      await redisService.set(cacheKey, address, GEOCODE_CACHE_TTL);
      logger.debug('Geocode result cached', { lat, lng });
    }

    res.json({
      success: true,
      address,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/composite-reports/geocode-batch
 * Geocode multiple coordinates to addresses with Redis caching
 */
router.post('/composite-reports/geocode-batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { coordinates } = req.body;
    const { sessionId } = getUserInfo(req);

    if (!sessionId) {
      throw new CustomError('Session ID (hash) is required for geocoding', 400);
    }

    if (!Array.isArray(coordinates)) {
      throw new CustomError('coordinates must be an array', 400);
    }

    if (coordinates.length > 50) {
      throw new CustomError('Maximum 50 coordinates per batch', 400);
    }
    const redisService = (await import('../services/redis.js')).RedisService.getInstance();
    const results: { lat: number; lng: number; address: string | null; cached?: boolean }[] = [];
    
    let cacheHits = 0;
    let apiCalls = 0;

    for (const coord of coordinates) {
      const { lat, lng } = coord;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        results.push({ lat, lng, address: null });
        continue;
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        results.push({ lat, lng, address: null });
        continue;
      }

      // Check cache first
      const cacheKey = getGeocodeCacheKey(lat, lng);
      const cachedAddress = await redisService.get(cacheKey);
      
      if (cachedAddress !== null) {
        results.push({ lat, lng, address: cachedAddress, cached: true });
        cacheHits++;
        continue;
      }

      // Not in cache, call API
      try {
        const response = await fetch('https://api.eu.navixy.com/v2/geocoder/search_location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hash: sessionId,
            location: { lat, lng },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const address = data.success ? data.value : null;
          results.push({ lat, lng, address, cached: false });
          
          // Cache successful results
          if (address) {
            await redisService.set(cacheKey, address, GEOCODE_CACHE_TTL);
          }
        } else {
          results.push({ lat, lng, address: null, cached: false });
        }
        apiCalls++;
      } catch {
        results.push({ lat, lng, address: null, cached: false });
        apiCalls++;
      }

      // Small delay between API requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    logger.info('Batch geocoding completed', { 
      total: coordinates.length, 
      cacheHits, 
      apiCalls 
    });

    res.json({
      success: true,
      results,
      stats: {
        total: coordinates.length,
        cacheHits,
        apiCalls,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
