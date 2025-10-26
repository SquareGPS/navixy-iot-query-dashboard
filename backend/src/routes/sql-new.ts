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
const dbService = DatabaseService.getInstance();
const redisService = RedisService.getInstance();

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

  // Generate cache key
  const cacheKey = generateParameterizedCacheKey(statement, params);
  
  try {
    // Try to get from cache first
    const cachedResult = await redisService.get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for parameterized query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute parameterized query
    const result = await dbService.executeParameterizedQuery(
      statement, 
      params, 
      limits?.timeout_ms || 30000,
      limits?.max_rows || 10000
    );
    
    // Cache result for 5 minutes
    await redisService.set(cacheKey, JSON.stringify(result), 300);
    
    logger.info('Parameterized query executed and cached', {
      userId: req.user?.userId,
      statement: statement.substring(0, 100) + '...',
      paramCount: Object.keys(params).length,
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
    const cachedResult = await redisService.get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for legacy table query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute query using legacy method for now
    const result = await dbService.executeTableQuery(sql, page, pageSize, sort);
    
    // Cache result for 5 minutes
    await redisService.set(cacheKey, JSON.stringify(result), 300);
    
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
    const cachedResult = await redisService.get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for legacy tile query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute query using legacy method for now
    const result = await dbService.executeTileQuery(sql);
    
    // Cache result for 2 minutes (tiles change more frequently)
    await redisService.set(cacheKey, JSON.stringify(result), 120);
    
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
