import { Router } from 'express';
import type { Response } from 'express';
import { DatabaseService } from '../services/database.js';
import { RedisService } from '../services/redis.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { validateSQLQuery } from '../utils/sqlValidationIntegration.js';
import crypto from 'crypto';

const router = Router();

// Initialize services lazily to avoid issues with environment variables
let dbService: DatabaseService;
let redisService: RedisService;

const getDbService = () => {
  if (!dbService) {
    dbService = DatabaseService.getInstance();
  }
  return dbService;
};

const getRedisService = () => {
  if (!redisService) {
    redisService = RedisService.getInstance();
  }
  return redisService;
};

// Generate cache key for SQL queries
function generateCacheKey(sql: string, params: any, userId?: string, iotDbUrl?: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(sql + JSON.stringify(params) + (userId || 'anonymous') + (iotDbUrl || 'none'));
  return `sql:${hash.digest('hex')}`;
}

// Helper function to get timeout from global variables
async function getGlobalTimeoutMs(settingsPool: any): Promise<number> {
  const defaultTimeout = 30000;
  if (!settingsPool) {
    logger.info('SQL timeout: using default (no settings pool)', { timeout: defaultTimeout });
    return defaultTimeout;
  }
  
  try {
    const dbService = getDbService();
    const globalVars = await dbService.getGlobalVariablesAsMap(settingsPool);
    if (globalVars.sql_timeout_ms) {
      const parsedTimeout = parseInt(globalVars.sql_timeout_ms, 10);
      if (!isNaN(parsedTimeout) && parsedTimeout > 0) {
        logger.info('SQL timeout: using global variable', { timeout: parsedTimeout, rawValue: globalVars.sql_timeout_ms });
        return parsedTimeout;
      }
    }
    logger.info('SQL timeout: using default (no global variable set)', { timeout: defaultTimeout, availableVars: Object.keys(globalVars) });
  } catch (error) {
    logger.warn('Failed to load global timeout, using default:', error);
  }
  return defaultTimeout;
}

// Execute table query with caching
router.post('/table', validateSQLQuery, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { sql, page = 1, pageSize = 25, sort } = req.body;

  // Get iotDbUrl from the authenticated user's token
  const iotDbUrl = req.user?.iotDbUrl;
  if (!iotDbUrl) {
    return res.status(400).json({
      error: {
        code: 'MISSING_IOT_DB_URL',
        message: 'iotDbUrl is required for query execution'
      }
    });
  }

  // Get timeout from global variables
  const timeoutMs = await getGlobalTimeoutMs(req.settingsPool);

  // Generate cache key
  const cacheKey = generateCacheKey(sql, { page, pageSize, sort }, req.user?.userId, iotDbUrl);
  
  try {
    // Try to get from cache first
    const cachedResult = await getRedisService().get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for table query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute query
    const result = await getDbService().executeTableQuery(sql, page, pageSize, sort, iotDbUrl, timeoutMs);
    
    // Cache result for 5 minutes
    await getRedisService().set(cacheKey, JSON.stringify(result), 300);
    
    logger.info('Table query executed and cached', {
      userId: req.user?.userId,
      sql: sql.substring(0, 100) + '...',
      totalRows: result.total,
      returnedRows: result.rows.length,
    });

    return res.json(result);
  } catch (error: any) {
    logger.error('Table query error:', {
      userId: req.user?.userId,
      error: error.message,
      sql: sql.substring(0, 100) + '...',
    });

    return res.status(200).json({
      error: {
        code: error.statusCode >= 500 ? 'INTERNAL_ERROR' : 'EXECUTION_ERROR',
        message: error.message,
        details: error.statusCode >= 500 ? undefined : {
          sqlCode: error.code,
          position: error.position,
        }
      }
    });
  }
}));

// Execute tile query with caching
router.post('/tile', validateSQLQuery, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { sql } = req.body;

  // Get iotDbUrl from the authenticated user's token
  const iotDbUrl = req.user?.iotDbUrl;
  if (!iotDbUrl) {
    return res.status(400).json({
      error: {
        code: 'MISSING_IOT_DB_URL',
        message: 'iotDbUrl is required for query execution'
      }
    });
  }

  // Get timeout from global variables
  const timeoutMs = await getGlobalTimeoutMs(req.settingsPool);

  // Generate cache key
  const cacheKey = generateCacheKey(sql, { type: 'tile' }, req.user?.userId, iotDbUrl);
  
  try {
    // Try to get from cache first
    const cachedResult = await getRedisService().get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for tile query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute query
    const result = await getDbService().executeTileQuery(sql, iotDbUrl, timeoutMs);
    
    // Cache result for 2 minutes (tiles change more frequently)
    await getRedisService().set(cacheKey, JSON.stringify(result), 120);
    
    logger.info('Tile query executed and cached', {
      userId: req.user?.userId,
      sql: sql.substring(0, 100) + '...',
      value: result.value,
    });

    return res.json(result);
  } catch (error: any) {
    logger.error('Tile query error:', {
      userId: req.user?.userId,
      error: error.message,
      sql: sql.substring(0, 100) + '...',
    });

    return res.status(200).json({
      error: {
        code: error.statusCode >= 500 ? 'INTERNAL_ERROR' : 'EXECUTION_ERROR',
        message: error.message,
        details: error.statusCode >= 500 ? undefined : {
          sqlCode: error.code,
          position: error.position,
        }
      }
    });
  }
}));

// Test database connection
router.post('/test-connection', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get iotDbUrl from the authenticated user's token
    const iotDbUrl = req.user?.iotDbUrl;
    if (!iotDbUrl) {
      return res.status(400).json({
        error: {
          code: 'MISSING_IOT_DB_URL',
          message: 'iotDbUrl is required for connection test'
        }
      });
    }

    // Simple test query
    const result = await getDbService().executeTableQuery('SELECT 1 as test', 1, 1, undefined, iotDbUrl);
    
    logger.info('Database connection test successful', {
      userId: req.user?.userId,
    });

    return res.json({
      success: true,
      message: 'Database connection successful',
      result: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Database connection test failed:', {
      userId: req.user?.userId,
      error: error.message,
    });

    return res.status(500).json({
      error: {
        code: 'CONNECTION_ERROR',
        message: 'Database connection failed',
        details: error.message
      }
    });
  }
}));

// Clear cache
router.post('/clear-cache', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    await getRedisService().flushdb();
    
    logger.info('Cache cleared', {
      userId: req.user?.userId,
    });

    return res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error: any) {
    logger.error('Cache clear error:', {
      userId: req.user?.userId,
      error: error.message,
    });

    return res.status(500).json({
      error: {
        code: 'CACHE_ERROR',
        message: 'Failed to clear cache',
        details: error.message
      }
    });
  }
}));

export { router as sqlRoutes };
