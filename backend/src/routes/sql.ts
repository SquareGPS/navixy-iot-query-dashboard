import { Router } from 'express';
import type { Response } from 'express';
import { DatabaseService } from '../services/database.js';
import { RedisService } from '../services/redis.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

const router = Router();
const dbService = DatabaseService.getInstance();
const redisService = RedisService.getInstance();

// Generate cache key for SQL queries
function generateCacheKey(sql: string, params: any): string {
  const hash = crypto.createHash('sha256');
  hash.update(sql + JSON.stringify(params));
  return `sql:${hash.digest('hex')}`;
}

// Execute table query with caching
router.post('/table', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { sql, page = 1, pageSize = 25, sort } = req.body;

  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({
      error: { code: 'INVALID_SQL', message: 'SQL query is required' }
    });
  }

  // Generate cache key
  const cacheKey = generateCacheKey(sql, { page, pageSize, sort });
  
  try {
    // Try to get from cache first
    const cachedResult = await redisService.get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for table query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute query
    const result = await dbService.executeTableQuery(sql, page, pageSize, sort);
    
    // Cache result for 5 minutes
    await redisService.set(cacheKey, JSON.stringify(result), 300);
    
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
router.post('/tile', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { sql } = req.body;

  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({
      error: { code: 'INVALID_SQL', message: 'SQL query is required' }
    });
  }

  // Generate cache key
  const cacheKey = generateCacheKey(sql, { type: 'tile' });
  
  try {
    // Try to get from cache first
    const cachedResult = await redisService.get(cacheKey);
    if (cachedResult) {
      logger.info('Cache hit for tile query', { cacheKey });
      return res.json(JSON.parse(cachedResult));
    }

    // Execute query
    const result = await dbService.executeTileQuery(sql);
    
    // Cache result for 2 minutes (tiles change more frequently)
    await redisService.set(cacheKey, JSON.stringify(result), 120);
    
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
    // Simple test query
    const result = await dbService.executeTableQuery('SELECT 1 as test', 1, 1);
    
    logger.info('Database connection test successful', {
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      message: 'Database connection successful',
      result: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Database connection test failed:', {
      userId: req.user?.userId,
      error: error.message,
    });

    res.status(500).json({
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
    await redisService.flushdb();
    
    logger.info('Cache cleared', {
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error: any) {
    logger.error('Cache clear error:', {
      userId: req.user?.userId,
      error: error.message,
    });

    res.status(500).json({
      error: {
        code: 'CACHE_ERROR',
        message: 'Failed to clear cache',
        details: error.message
      }
    });
  }
}));

export { router as sqlRoutes };

