/**
 * New SQL Execution Endpoint
 * Supports typed parameter binding for Grafana-based renderer
 */

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

// Interface for the new parameter binding request
interface ParameterizedQueryRequest {
  dialect: string;
  statement: string;
  params: Record<string, unknown>;
  limits: {
    timeout_ms: number;
    max_rows: number;
  };
  read_only: boolean;
  pagination?: {
    page: number;
    pageSize: number;
  };
}

// Interface for the response
interface QueryResponse {
  columns: Array<{ name: string; type: string }>;
  rows: unknown[][];
  stats?: {
    rowCount: number;
    elapsedMs: number;
    usedParamCount?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

// Generate cache key for parameterized queries
function generateParameterizedCacheKey(
  statement: string, 
  params: Record<string, unknown>,
  userId?: string,
  iotDbUrl?: string,
  pagination?: { page: number; pageSize: number }
): string {
  const hash = crypto.createHash('sha256');
  const keyData = {
    statement,
    params: Object.keys(params).sort().reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>),
    userId: userId || 'anonymous',
    iotDbUrl: iotDbUrl || 'none',
    pagination: pagination || null
  };
  
  hash.update(JSON.stringify(keyData));
  return `sql:param:${hash.digest('hex')}`;
}

// Execute parameterized SQL query
router.post('/execute', validateSQLQuery, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { dialect, statement, params, limits, read_only, pagination }: ParameterizedQueryRequest = req.body;

  // Validate request structure
  if (!statement) {
    return res.status(400).json({
      error: {
        code: 'MISSING_STATEMENT',
        message: 'SQL statement is required'
      }
    });
  }

  if (!params || typeof params !== 'object') {
    return res.status(400).json({
      error: {
        code: 'INVALID_PARAMS',
        message: 'Parameters must be an object'
      }
    });
  }

  // Validate pagination if provided
  if (pagination) {
    if (typeof pagination.page !== 'number' || typeof pagination.pageSize !== 'number') {
      return res.status(400).json({
        error: {
          code: 'INVALID_PAGINATION',
          message: 'Pagination page and pageSize must be numbers'
        }
      });
    }
    if (pagination.page < 1 || pagination.pageSize < 1 || pagination.pageSize > 10000) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PAGINATION',
          message: 'Page must be >= 1 and pageSize must be between 1 and 10000'
        }
      });
    }
  }

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

  // Merge global variables into params (global variables have lower priority than explicit params)
  let mergedParams = { ...params };
  let globalTimeoutMs: number | undefined;
  
  try {
    if (req.settingsPool) {
      const dbService = getDbService();
      const globalVars = await dbService.getGlobalVariablesAsMap(req.settingsPool);
      
      // Extract sql_timeout_ms from global variables if set
      if (globalVars.sql_timeout_ms) {
        const parsedTimeout = parseInt(globalVars.sql_timeout_ms, 10);
        if (!isNaN(parsedTimeout) && parsedTimeout > 0) {
          globalTimeoutMs = parsedTimeout;
        }
      }
      
      // Only add global variables that aren't already in params (explicit params take precedence)
      Object.entries(globalVars).forEach(([key, value]) => {
        if (!(key in mergedParams)) {
          mergedParams[key] = value;
        }
      });
    }
  } catch (error) {
    logger.warn('Failed to load global variables, continuing without them:', error);
    // Continue execution without global variables if there's an error
  }

  // Determine timeout: global variable > request limits > default (30s)
  // Global variable takes priority to give admin control over query timeouts
  const effectiveTimeoutMs = globalTimeoutMs || limits?.timeout_ms || 30000;
  
  logger.info('SQL query timeout configuration', {
    requestTimeout: limits?.timeout_ms,
    globalVarTimeout: globalTimeoutMs,
    effectiveTimeout: effectiveTimeoutMs,
    source: globalTimeoutMs ? 'global_variable' : (limits?.timeout_ms ? 'request' : 'default')
  });

  // Generate cache key (use merged params, userId, iotDbUrl, and pagination for caching)
  const cacheKey = generateParameterizedCacheKey(statement, mergedParams, req.user?.userId, iotDbUrl, pagination);
  
  try {
    // Try to get from cache first
    const cachedResult = await getRedisService().get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for parameterized query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute parameterized query with merged params and pagination
    const result = await getDbService().executeParameterizedQuery(
      statement, 
      mergedParams, 
      effectiveTimeoutMs,
      limits?.max_rows || 10000,
      iotDbUrl, // Pass iotDbUrl for database connection
      pagination // Pass pagination if provided
    );
    
    // Cache result for 5 minutes
    await getRedisService().set(cacheKey, JSON.stringify(result), 300);
    
    logger.info('Parameterized query executed and cached', {
      userId: req.user?.userId,
      statement: statement.substring(0, 100) + '...',
      paramCount: result.stats?.usedParamCount || 0,
      totalParams: Object.keys(params).length,
      totalRows: result.stats?.rowCount || 0,
      pagination: pagination ? `page ${pagination.page}, size ${pagination.pageSize}` : 'none',
    });

    return res.json(result);
  } catch (error: any) {
    logger.error('Parameterized query error:', {
      userId: req.user?.userId,
      error: error.message,
      statement: statement.substring(0, 100) + '...',
      paramCount: Object.keys(params).length,
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

// Legacy endpoints for backward compatibility
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
  const cacheKey = generateParameterizedCacheKey(sql, { page, pageSize, sort }, req.user?.userId, iotDbUrl);
  
  try {
    // Try to get from cache first
    const cachedResult = await getRedisService().get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for legacy table query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute query using legacy method
    const result = await getDbService().executeTableQuery(sql, page, pageSize, sort, iotDbUrl, timeoutMs);
    
    // Cache result for 5 minutes
    await getRedisService().set(cacheKey, JSON.stringify(result), 300);
    
    logger.info('Legacy table query executed and cached', {
      userId: req.user?.userId,
      sql: sql.substring(0, 100) + '...',
      totalRows: result.total,
      returnedRows: result.rows.length,
    });

    return res.json(result);
  } catch (error: any) {
    logger.error('Legacy table query error:', {
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
  const cacheKey = generateParameterizedCacheKey(sql, { type: 'tile' }, req.user?.userId, iotDbUrl);
  
  try {
    // Try to get from cache first
    const cachedResult = await getRedisService().get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for legacy tile query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute query using legacy method
    const result = await getDbService().executeTileQuery(sql, iotDbUrl, timeoutMs);
    
    // Cache result for 2 minutes (tiles change more frequently)
    await getRedisService().set(cacheKey, JSON.stringify(result), 120);
    
    logger.info('Legacy tile query executed and cached', {
      userId: req.user?.userId,
      sql: sql.substring(0, 100) + '...',
      value: result.value,
    });

    return res.json(result);
  } catch (error: any) {
    logger.error('Legacy tile query error:', {
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

export default router;
