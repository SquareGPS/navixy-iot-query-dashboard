import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

export class RedisService {
  private static instance: RedisService;
  private redis: Redis | null = null;

  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  static async initialize(): Promise<void> {
    const instance = RedisService.getInstance();
    await instance.connect();
  }

  private async connect(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.redis = new Redis(redisUrl, {
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      this.redis.on('error', (error) => {
        logger.error('Redis connection error:', error);
        // Don't throw error, just log it for local development
        if (process.env.NODE_ENV === 'development') {
          logger.warn('Redis unavailable in development mode - continuing without caching');
          this.redis = null;
        } else {
          throw error;
        }
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
      });

      await this.redis.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Redis unavailable in development mode - continuing without caching');
        this.redis = null;
      } else {
        throw error;
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.redis) {
      logger.warn('Redis not available - returning null for get operation');
      return null;
    }
    
    try {
      return await this.redis.get(key);
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.redis) {
      logger.warn('Redis not available - skipping set operation');
      return;
    }
    
    try {
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      logger.error('Redis SET error:', error);
      // Don't throw error in development mode
      if (process.env.NODE_ENV !== 'development') {
        throw error;
      }
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) {
      logger.warn('Redis not available - skipping delete operation');
      return;
    }
    
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', error);
      // Don't throw error in development mode
      if (process.env.NODE_ENV !== 'development') {
        throw error;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.redis) {
      logger.warn('Redis not available - returning false for exists check');
      return false;
    }
    
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return false;
    }
  }

  async flushdb(): Promise<void> {
    if (!this.redis) {
      logger.warn('Redis not available - skipping flush operation');
      return;
    }
    
    try {
      await this.redis.flushdb();
    } catch (error) {
      logger.error('Redis FLUSHDB error:', error);
      // Don't throw error in development mode
      if (process.env.NODE_ENV !== 'development') {
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
      this.redis = null;
      logger.info('Redis disconnected');
    }
  }

  async close(): Promise<void> {
    return this.disconnect();
  }
}

