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
  params: Record<string, unknown>
): string {
  const hash = crypto.createHash('sha256');
  const keyData = {
    statement,
    params: Object.keys(params).sort().reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>)
  };
  
  hash.update(JSON.stringify(keyData));
  return `sql:param:${hash.digest('hex')}`;
}

// Execute parameterized SQL query
router.post('/execute', validateSQLQuery, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { dialect, statement, params, limits, read_only }: ParameterizedQueryRequest = req.body;

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

  // Merge global variables into params (global variables have lower priority than explicit params)
  let mergedParams = { ...params };
  try {
    const dbService = getDbService();
    const appPool = await dbService.getPoolForRequest(req.user?.connectionHash);
    const globalVars = await dbService.getGlobalVariablesAsMap(appPool);
    // Only add global variables that aren't already in params (explicit params take precedence)
    Object.entries(globalVars).forEach(([key, value]) => {
      if (!(key in mergedParams)) {
        mergedParams[key] = value;
      }
    });
  } catch (error) {
    logger.warn('Failed to load global variables, continuing without them:', error);
    // Continue execution without global variables if there's an error
  }

  // Generate cache key (use merged params for caching)
  const cacheKey = generateParameterizedCacheKey(statement, mergedParams);
  
  try {
    // Try to get from cache first
    const cachedResult = await getRedisService().get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for parameterized query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute parameterized query with merged params
    const result = await getDbService().executeParameterizedQuery(
      statement, 
      mergedParams, 
      limits?.timeout_ms || 30000,
      limits?.max_rows || 10000
    );
    
    // Cache result for 5 minutes
    await getRedisService().set(cacheKey, JSON.stringify(result), 300);
    
    logger.info('Parameterized query executed and cached', {
      userId: req.user?.userId,
      statement: statement.substring(0, 100) + '...',
      paramCount: result.stats?.usedParamCount || 0,
      totalParams: Object.keys(params).length,
      totalRows: result.stats?.rowCount || 0,
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

// Legacy endpoints for backward compatibility
router.post('/table', validateSQLQuery, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { sql, page = 1, pageSize = 25, sort } = req.body;

  // Convert legacy request to new format
  const parameterizedRequest: ParameterizedQueryRequest = {
    dialect: 'postgresql',
    statement: sql,
    params: {},
    limits: {
      timeout_ms: 30000,
      max_rows: pageSize
    },
    read_only: true
  };

  // Generate cache key
  const cacheKey = generateParameterizedCacheKey(sql, { page, pageSize, sort });
  
  try {
    // Try to get from cache first
    const cachedResult = await getRedisService().get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for legacy table query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute query using legacy method for now
    const result = await getDbService().executeTableQuery(sql, page, pageSize, sort);
    
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

  // Generate cache key
  const cacheKey = generateParameterizedCacheKey(sql, { type: 'tile' });
  
  try {
    // Try to get from cache first
    const cachedResult = await getRedisService().get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for legacy tile query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute query using legacy method for now
    const result = await getDbService().executeTileQuery(sql);
    
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
