import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { logger } from '../utils/logger.js';
import { CustomError } from '../middleware/errorHandler.js';
import { SQLSelectGuard } from '../utils/sqlSelectGuard.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { existsSync } from 'fs';

export interface DatabaseConfig {
  user: string;
  password: string;
  database: string;
  hostname: string;
  port: number;
  ssl?: boolean;
}


export interface QueryResult {
  columns: string[];
  rows: any[];
  columnTypes: Record<string, string>;
  total: number;
  page: number;
  pageSize: number;
}

export interface TileResult {
  value: number | null;
}

export interface ParameterizedQueryResult {
  columns: Array<{ name: string; type: string }>;
  rows: unknown[][];
  stats: {
    rowCount: number;
    elapsedMs: number;
    usedParamCount?: number;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface User {
  id: string;
  email: string;
  password_hash?: string | null;
  email_confirmed_at?: string;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
  raw_user_meta_data?: any;
  raw_app_meta_data?: any;
  is_super_admin: boolean;
}

export interface UserRole {
  user_id: string;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
}

export class DatabaseService {
  private static instance: DatabaseService;
  public appPool: Pool;
  private externalPools: Map<string, Pool> = new Map();

  constructor() {
    // Initialize app database connection
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.appPool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    logger.info('Database service initialized with local PostgreSQL');
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  static async initialize(): Promise<void> {
    const instance = DatabaseService.getInstance();
    await instance.testConnection();
  }

  private async testConnection(): Promise<void> {
    try {
      const client = await this.appPool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.info('App database connection successful');
    } catch (error) {
      logger.error('Failed to connect to app database:', error);
      throw error;
    }
  }

  // Test database connection (for settings page)
  async testDatabaseConnection(settings: any): Promise<void> {
    try {
      let config: DatabaseConfig;

      if (settings.external_db_url) {
        config = this.parsePostgresUrl(settings.external_db_url);
      } else if (settings.external_db_host && settings.external_db_name && settings.external_db_user) {
        config = {
          user: settings.external_db_user,
          password: settings.external_db_password || '',
          database: settings.external_db_name,
          hostname: settings.external_db_host,
          port: settings.external_db_port || 5432,
          ssl: settings.external_db_ssl || false,
        };
      } else {
        throw new CustomError('Incomplete database configuration provided for testing', 400);
      }
      
      // Create a temporary pool for testing
      const poolConfig = {
        user: config.user,
        password: config.password,
        database: config.database,
        host: config.hostname,
        port: config.port,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        max: 1,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 10000, // Increased timeout
      };

      logger.info('Creating test pool with config', {
        host: poolConfig.host,
        port: poolConfig.port,
        database: poolConfig.database,
        user: poolConfig.user,
        connectionTimeout: poolConfig.connectionTimeoutMillis
      });

      const testPool = new Pool(poolConfig);

      let client: PoolClient | null = null;
      try {
        logger.info('Attempting to connect to database...');
        const connectStartTime = Date.now();
        client = await testPool.connect();
        const connectTime = Date.now() - connectStartTime;
        logger.info('Successfully obtained client from pool', { connectTimeMs: connectTime });

        logger.info('Executing test query...');
        const queryStartTime = Date.now();
        const result = await client.query('SELECT 1 as test');
        const queryTime = Date.now() - queryStartTime;
        logger.info('Test query executed successfully', { 
          queryTimeMs: queryTime,
          result: result.rows[0]
        });

        logger.info('Database connection test successful', {
          host: config.hostname,
          port: config.port,
          database: config.database,
          user: config.user,
          totalTimeMs: Date.now() - connectStartTime
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as any)?.code;
        const errorSyscall = (error as any)?.syscall;
        const errorAddress = (error as any)?.address;
        const errorPort = (error as any)?.port;
        
        logger.error('Database connection test failed - detailed error:', {
          host: config.hostname,
          port: config.port,
          database: config.database,
          user: config.user,
          errorMessage,
          errorCode,
          errorSyscall,
          errorAddress,
          errorPort,
          errorStack: error instanceof Error ? error.stack : undefined,
          errorName: error instanceof Error ? error.name : undefined
        });
        
        // Provide more helpful error messages
        let userFriendlyMessage = errorMessage;
        if (errorMessage.includes('ECONNREFUSED') || errorCode === 'ECONNREFUSED') {
          userFriendlyMessage = `Cannot connect to database at ${config.hostname}:${config.port}. Please ensure PostgreSQL is running and accessible from the backend server. Error code: ${errorCode || 'ECONNREFUSED'}`;
        } else if (errorMessage.includes('authentication failed') || errorMessage.includes('password') || errorCode === '28P01') {
          userFriendlyMessage = `Authentication failed. Please check your username and password. Error code: ${errorCode || 'AUTH_ERROR'}`;
        } else if (errorMessage.includes('does not exist') || errorCode === '3D000') {
          userFriendlyMessage = `Database "${config.database}" does not exist. Please check the database name. Error code: ${errorCode || 'DB_NOT_FOUND'}`;
        } else if (errorCode) {
          userFriendlyMessage = `${errorMessage} (Error code: ${errorCode})`;
        }
        
        throw new CustomError(`Failed to connect to database: ${userFriendlyMessage}`, 400);
      } finally {
        if (client) {
          logger.info('Releasing client...');
          client.release();
        }
        logger.info('Ending test pool...');
        await testPool.end();
        logger.info('Test pool ended');
      }
    } catch (error) {
      // Re-throw CustomError as-is, wrap others
      if (error instanceof CustomError) {
        logger.error('CustomError thrown during connection test', {
          message: error.message,
          statusCode: error.statusCode
        });
        throw error;
      }
      logger.error('Unexpected error testing database connection:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name
      });
      throw new CustomError(
        `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        400
      );
    }
  }

  // ==========================================
  // Authentication Methods
  // ==========================================

  async authenticateUser(
    email: string, 
    password: string
  ): Promise<{ user: User; token: string } | null> {
    try {
      const client = await this.appPool.connect();
      
      try {
        const result = await client.query(
          'SELECT * FROM public.users WHERE email = $1',
          [email]
        );

        if (result.rows.length === 0) {
          return null;
        }

        const user = result.rows[0] as User;
        
        // If user has no password_hash, skip password check (token-based auth)
        if (user.password_hash) {
          const isValidPassword = await bcrypt.compare(password, user.password_hash);
          if (!isValidPassword) {
            return null;
          }
        }

        // Update last sign in
        await client.query(
          'UPDATE public.users SET last_sign_in_at = NOW() WHERE id = $1',
          [user.id]
        );

        // Generate JWT token
        const token = jwt.sign(
          { 
            userId: user.id, 
            email: user.email,
            role: await this.getUserRole(user.id, this.appPool)
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '24h' }
        );

        return { user, token };
      } finally {
        client.release();
      }
    } catch (error) {
      // Preserve CustomError messages, but wrap other errors
      if (error instanceof CustomError) {
        logger.error('Authentication error:', {
          message: error.message,
          statusCode: error.statusCode
        });
        throw error;
      }
      logger.error('Authentication error:', error);
      throw new CustomError(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  // Passwordless authentication for plugin mode
  async authenticateUserPasswordless(
    email: string,
    role: 'admin' | 'editor' | 'viewer',
    metabaseDbUrl: string,
    iotDbUrl: string
  ): Promise<{ user: User; token: string }> {
    try {
      const client = await this.appPool.connect();
      
      try {
        // Check if user exists in local database (match by email)
        let result = await client.query(
          'SELECT * FROM public.users WHERE email = $1',
          [email]
        );

        let user: User;
        let isNewUser = false;
        
        if (result.rows.length === 0) {
          // Create new user without password
          logger.info('Creating new user for passwordless auth', { email, role });
          const insertResult = await client.query(
            `INSERT INTO public.users (email, password_hash, email_confirmed_at, is_super_admin)
             VALUES ($1, NULL, NOW(), $2)
             RETURNING *`,
            [email, role === 'admin']
          );
          user = insertResult.rows[0] as User;
          isNewUser = true;

          // Create user role - delete existing roles first, then insert new one
          // This handles both schema types: single PK on user_id or composite PK on (user_id, role)
          await client.query('DELETE FROM public.user_roles WHERE user_id = $1', [user.id]);
          await client.query('INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)', [user.id, role]);
        } else {
          user = result.rows[0] as User;
          logger.info('Found existing user for passwordless auth', { email, userId: user.id, role });
          
          // Update user role - delete existing roles first, then insert new one
          await client.query('DELETE FROM public.user_roles WHERE user_id = $1', [user.id]);
          await client.query('INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)', [user.id, role]);
        }

        // Update last sign in
        await client.query(
          'UPDATE public.users SET last_sign_in_at = NOW() WHERE id = $1',
          [user.id]
        );

        // Update raw_user_meta_data with connection URLs
        const metaData = { metabaseDbUrl, iotDbUrl };
        await client.query(
          'UPDATE public.users SET raw_user_meta_data = $1 WHERE id = $2',
          [JSON.stringify(metaData), user.id]
        );
        
        logger.info('Updated user raw_user_meta_data with connection URLs', { 
          userId: user.id, 
          email,
          isNewUser,
          hasIotDbUrl: !!iotDbUrl,
          hasMetabaseDbUrl: !!metabaseDbUrl
        });

        // Generate JWT token
        const token = jwt.sign(
          { 
            userId: user.id, 
            email: user.email,
            role: role
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '24h' }
        );

        return { user, token };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Passwordless authentication error:', error);
      throw new CustomError(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  async getUserRole(userId: string, pool?: Pool): Promise<string> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        const result = await client.query(
          'SELECT role FROM public.user_roles WHERE user_id = $1',
          [userId]
        );

        return result.rows.length > 0 ? result.rows[0].role : 'viewer';
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting user role:', error);
      return 'viewer';
    }
  }

  async createUser(
    email: string, 
    password: string, 
    role: string = 'viewer'
  ): Promise<User> {
    try {
      const client = await this.appPool.connect();
      
      try {
        const passwordHash = await bcrypt.hash(password, 10);
        
        const result = await client.query(
          `INSERT INTO public.users (email, password_hash, email_confirmed_at, is_super_admin)
           VALUES ($1, $2, NOW(), $3)
           RETURNING *`,
          [email, passwordHash, role === 'admin']
        );

        const user = result.rows[0] as User;

        // Create user role
        await client.query(
          'INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)',
          [user.id, role]
        );

        return user;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error creating user:', error);
      throw new CustomError('Failed to create user', 500);
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      const client = await this.appPool.connect();
      
      try {
        const result = await client.query(
          'SELECT * FROM public.users ORDER BY created_at ASC'
        );

        return result.rows as User[];
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting users:', error);
      throw new CustomError('Failed to get users', 500);
    }
  }


  // ==========================================
  // App Settings Methods
  // ==========================================

  async getAppSettings(pool?: Pool): Promise<any> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        const result = await client.query(
          'SELECT * FROM public.app_settings WHERE id = 1'
        );

        return result.rows.length > 0 ? result.rows[0] : null;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting app settings:', error);
      throw new CustomError('Failed to get app settings', 500);
    }
  }

  async updateAppSettings(settings: any, pool?: Pool): Promise<void> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        await client.query(
          `UPDATE public.app_settings 
           SET timezone = $1, external_db_url = $2,
               external_db_host = $3, external_db_port = $4, external_db_name = $5,
               external_db_user = $6, external_db_password = $7, external_db_ssl = $8
           WHERE id = 1`,
          [
            settings.timezone,
            settings.external_db_url,
            settings.external_db_host,
            settings.external_db_port,
            settings.external_db_name,
            settings.external_db_user,
            settings.external_db_password,
            settings.external_db_ssl
          ]
        );
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error updating app settings:', error);
      throw new CustomError('Failed to update app settings', 500);
    }
  }

  // ==========================================
  // Global Variables Methods
  // ==========================================

  async getGlobalVariables(pool?: Pool): Promise<any[]> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        // Check if table exists first
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'global_variables'
          )
        `);

        if (!tableExists.rows[0].exists) {
          logger.warn('global_variables table does not exist yet');
          return [];
        }

        const result = await client.query(
          'SELECT * FROM public.global_variables ORDER BY label ASC'
        );

        return result.rows;
      } finally {
        client.release();
      }
    } catch (error: any) {
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01') { // undefined_table
        logger.warn('global_variables table does not exist:', error.message);
        return [];
      }
      logger.error('Error getting global variables:', error);
      throw new CustomError('Failed to get global variables', 500);
    }
  }

  async getGlobalVariableById(id: string, pool?: Pool): Promise<any | null> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        const result = await client.query(
          'SELECT * FROM public.global_variables WHERE id = $1',
          [id]
        );

        return result.rows.length > 0 ? result.rows[0] : null;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting global variable:', error);
      throw new CustomError('Failed to get global variable', 500);
    }
  }

  async createGlobalVariable(data: {
    label: string;
    description?: string;
    value?: string;
  }, pool?: Pool): Promise<any> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        const result = await client.query(
          `INSERT INTO public.global_variables (label, description, value)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [data.label, data.description || null, data.value || null]
        );

        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new CustomError('A variable with this label already exists', 409);
      }
      logger.error('Error creating global variable:', error);
      throw error instanceof CustomError ? error : new CustomError('Failed to create global variable', 500);
    }
  }

  async updateGlobalVariable(id: string, data: {
    label?: string;
    description?: string;
    value?: string;
  }, pool?: Pool): Promise<any> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        // Get existing variable
        const existing = await this.getGlobalVariableById(id, dbPool);
        if (!existing) {
          throw new CustomError('Global variable not found', 404);
        }

        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        // Allow updating all fields
        if (data.label !== undefined) {
          updateFields.push(`label = $${paramIndex}`);
          updateValues.push(data.label);
          paramIndex++;
        }
        if (data.description !== undefined) {
          updateFields.push(`description = $${paramIndex}`);
          updateValues.push(data.description);
          paramIndex++;
        }
        if (data.value !== undefined) {
          updateFields.push(`value = $${paramIndex}`);
          updateValues.push(data.value);
          paramIndex++;
        }

        if (updateFields.length === 0) {
          return existing;
        }

        updateFields.push(`updated_at = NOW()`);
        updateValues.push(id);

        const result = await client.query(
          `UPDATE public.global_variables 
           SET ${updateFields.join(', ')}
           WHERE id = $${paramIndex}
           RETURNING *`,
          updateValues
        );

        if (result.rows.length === 0) {
          throw new CustomError('Global variable not found', 404);
        }

        return result.rows[0];
      } finally {
        client.release();
      }
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw new CustomError('A variable with this label already exists', 409);
      }
      logger.error('Error updating global variable:', error);
      throw error instanceof CustomError ? error : new CustomError('Failed to update global variable', 500);
    }
  }

  // ==========================================
  // User Preferences Methods
  // ==========================================

  async getUserPreferences(userId: string, pool?: Pool): Promise<{ timezone: string } | null> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        // Check if table exists first
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_preferences'
          )
        `);

        if (!tableExists.rows[0].exists) {
          logger.warn('user_preferences table does not exist yet');
          return null;
        }

        const result = await client.query(
          'SELECT timezone FROM public.user_preferences WHERE user_id = $1',
          [userId]
        );

        if (result.rows.length === 0) {
          return null; // No preferences set, will default to UTC
        }

        return {
          timezone: result.rows[0].timezone || 'UTC'
        };
      } finally {
        client.release();
      }
    } catch (error: any) {
      // If table doesn't exist, return null instead of error
      if (error.code === '42P01') { // undefined_table
        logger.warn('user_preferences table does not exist:', error.message);
        return null;
      }
      logger.error('Error getting user preferences:', error);
      throw new CustomError('Failed to get user preferences', 500);
    }
  }

  async updateUserPreferences(userId: string, preferences: { timezone: string }, pool?: Pool): Promise<{ timezone: string }> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        // Validate timezone
        if (!this.isValidTimezone(preferences.timezone)) {
          throw new CustomError(`Invalid timezone: ${preferences.timezone}`, 400);
        }

        // Check if table exists first
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_preferences'
          )
        `);

        if (!tableExists.rows[0].exists) {
          throw new CustomError('user_preferences table does not exist. Please run migration.', 500);
        }

        // Use INSERT ... ON CONFLICT to handle both insert and update
        const result = await client.query(
          `INSERT INTO public.user_preferences (user_id, timezone, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id) 
           DO UPDATE SET timezone = $2, updated_at = NOW()
           RETURNING timezone`,
          [userId, preferences.timezone]
        );

        return {
          timezone: result.rows[0].timezone
        };
      } finally {
        client.release();
      }
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error updating user preferences:', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        userId
      });
      throw new CustomError(
        `Failed to update user preferences: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Validate timezone string against IANA timezone database
   * Uses Intl.supportedValuesOf if available, otherwise validates format
   */
  private isValidTimezone(timezone: string): boolean {
    if (!timezone || typeof timezone !== 'string' || timezone.length > 50) {
      return false;
    }

    // Check if Intl.supportedValuesOf is available (Node.js 20+)
    try {
      if (typeof Intl.supportedValuesOf === 'function') {
        const supportedTimezones = Intl.supportedValuesOf('timeZone');
        return supportedTimezones.includes(timezone);
      }
    } catch (e) {
      // Fallback if not available
      logger.warn('Intl.supportedValuesOf not available, using fallback validation');
    }

    // Fallback validation: check format and try to use it
    // Format: Continent/City or similar (e.g., America/New_York, Europe/London, UTC)
    // Also allow common formats like UTC, GMT, etc.
    if (timezone === 'UTC' || timezone === 'GMT') {
      return true;
    }

    // Try to create a date formatter with this timezone to validate
    try {
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      // If we can create a formatter, the timezone is valid
      return true;
    } catch (e) {
      logger.warn(`Invalid timezone format: ${timezone}`, e);
      return false;
    }
  }

  async deleteGlobalVariable(id: string, pool?: Pool): Promise<void> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        const result = await client.query(
          'DELETE FROM public.global_variables WHERE id = $1',
          [id]
        );

        if (result.rowCount === 0) {
          throw new CustomError('Global variable not found', 404);
        }
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error deleting global variable:', error);
      throw error instanceof CustomError ? error : new CustomError('Failed to delete global variable', 500);
    }
  }

  async getGlobalVariablesAsMap(pool?: Pool): Promise<Record<string, string>> {
    try {
      const variables = await this.getGlobalVariables(pool);
      const map: Record<string, string> = {};
      
      variables.forEach(variable => {
        if (variable.value !== null && variable.value !== undefined) {
          map[variable.label] = variable.value;
        }
      });

      return map;
    } catch (error) {
      logger.error('Error getting global variables as map:', error);
      // Return empty map instead of throwing error
      return {};
    }
  }

  // ==========================================
  // External Database Methods
  // ==========================================

  /**
   * Get user's IoT database URL from raw_user_meta_data
   * @param userId - User's ID to look up
   * @returns The iotDbUrl from user's metadata, or null if not found
   */
  async getUserIotDbUrl(userId: string): Promise<string | null> {
    try {
      const client = await this.appPool.connect();
      
      try {
        const result = await client.query(
          'SELECT raw_user_meta_data FROM public.users WHERE id = $1',
          [userId]
        );

        if (result.rows.length === 0) {
          logger.warn('User not found when fetching iotDbUrl', { userId });
          return null;
        }

        const rawMetaData = result.rows[0].raw_user_meta_data;
        
        if (!rawMetaData) {
          logger.warn('User has no raw_user_meta_data', { userId });
          return null;
        }

        // Parse if it's a string, otherwise use as-is (PostgreSQL JSONB)
        const metaData = typeof rawMetaData === 'string' 
          ? JSON.parse(rawMetaData) 
          : rawMetaData;

        if (!metaData.iotDbUrl) {
          logger.warn('User raw_user_meta_data has no iotDbUrl', { userId });
          return null;
        }

        return metaData.iotDbUrl;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error fetching user iotDbUrl:', { error, userId });
      throw new CustomError('Failed to get user database configuration', 500);
    }
  }

  async testConnectionWithSettings(settings: any): Promise<void> {
    try {
      let config: DatabaseConfig;

      if (settings.external_db_url) {
        config = this.parsePostgresUrl(settings.external_db_url);
      } else if (settings.external_db_host && settings.external_db_name && settings.external_db_user) {
        config = {
          user: settings.external_db_user,
          password: settings.external_db_password || '',
          database: settings.external_db_name,
          hostname: settings.external_db_host,
          port: settings.external_db_port || 5432,
          ssl: settings.external_db_ssl || false,
        };
      } else {
        throw new CustomError('Incomplete database configuration provided for testing', 400);
      }

      // Create a temporary pool for testing
      const testPool = new Pool({
        user: config.user,
        password: config.password,
        database: config.database,
        host: config.hostname,
        port: config.port,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        max: 1,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 5000,
      });

      let client: PoolClient | null = null;
      try {
        client = await testPool.connect();
        await client.query('SELECT 1 as test');
        logger.info('Test connection successful', {
          host: config.hostname,
          port: config.port,
          database: config.database,
          user: config.user
        });
      } finally {
        if (client) {
          client.release();
        }
        await testPool.end();
      }
    } catch (error: any) {
      logger.error('Test connection failed:', {
        error: error.message,
        settings: {
          host: settings.external_db_host,
          port: settings.external_db_port,
          database: settings.external_db_name,
          user: settings.external_db_user,
          hasPassword: !!settings.external_db_password
        }
      });
      throw new CustomError(`Database connection failed: ${error.message}`, 400);
    }
  }

  private async getExternalDatabaseConfig(userId?: string): Promise<DatabaseConfig> {
    try {
      // First, try to get iotDbUrl from user's metadata if userId is provided
      if (userId) {
        const iotDbUrl = await this.getUserIotDbUrl(userId);
        if (iotDbUrl) {
          logger.info('Using iotDbUrl from user metadata', { userId, iotDbUrl });
          return this.parsePostgresUrl(iotDbUrl);
        }
        logger.warn('User iotDbUrl not found, falling back to app settings', { userId });
      }

      // Fallback to app settings if no user email or no iotDbUrl in user metadata
      const settings = await this.getAppSettings();
      
      if (!settings) {
        throw new CustomError('App settings not found', 500);
      }

      let config: DatabaseConfig;

      if (settings.external_db_url) {
        config = this.parsePostgresUrl(settings.external_db_url);
      } else if (settings.external_db_host && settings.external_db_name && settings.external_db_user) {
        config = {
          user: settings.external_db_user,
          password: settings.external_db_password || '',
          database: settings.external_db_name,
          hostname: settings.external_db_host,
          port: settings.external_db_port || 5432,
          ssl: settings.external_db_ssl || false,
        };
      } else {
        throw new CustomError('External database not configured. Please configure the external database connection in Settings.', 500);
      }

      return config;
    } catch (error) {
      logger.error('Error fetching external database config:', error);
      throw error;
    }
  }

  private parsePostgresUrl(url: string): DatabaseConfig {
    try {
      // Handle postgresql:// URLs
      if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
        throw new Error('Database URL must start with postgresql:// or postgres://');
      }

      const urlObj = new URL(url);
      const sslmode = urlObj.searchParams.get('sslmode');
      
      if (!urlObj.hostname) {
        throw new Error('Database URL must include a hostname');
      }

      if (!urlObj.pathname || urlObj.pathname === '/') {
        throw new Error('Database URL must include a database name');
      }

      // Normalize localhost to IPv4, and handle Docker networking
      let hostname = urlObj.hostname;
      const isDocker = process.env.DOCKER_ENV === 'true' || existsSync('/.dockerenv');
      
      if (hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || hostname === '127.0.0.1') {
        // If running in Docker, use host.docker.internal to reach host machine
        hostname = isDocker ? 'host.docker.internal' : '127.0.0.1';
        logger.info('Normalized localhost in URL', { 
          original: urlObj.hostname, 
          normalized: hostname,
          isDocker 
        });
      } else if (hostname === 'postgres' && !isDocker) {
        // Convert Docker hostname "postgres" to localhost when running locally
        hostname = '127.0.0.1';
        logger.info('Normalized Docker hostname "postgres" to localhost', { 
          original: urlObj.hostname, 
          normalized: hostname 
        });
      }
    
      return {
        user: decodeURIComponent(urlObj.username || ''),
        password: decodeURIComponent(urlObj.password || ''),
        database: urlObj.pathname.slice(1), // Remove leading /
        hostname: hostname,
        port: parseInt(urlObj.port) || 5432,
        ssl: sslmode === 'require',
      };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error parsing PostgreSQL URL:', { url, error });
      throw new CustomError(`Invalid PostgreSQL URL format ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`, 400);
    }
  }

  private async getExternalPool(config: DatabaseConfig): Promise<Pool> {
    const configKey = `${config.hostname}:${config.port}/${config.database}`;
    
    if (!this.externalPools.has(configKey)) {
      const pool = new Pool({
        user: config.user,
        password: config.password,
        database: config.database,
        host: config.hostname,
        port: config.port,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      this.externalPools.set(configKey, pool);
    }

    return this.externalPools.get(configKey)!;
  }

  // ==========================================
  // Query Execution Methods
  // ==========================================

  private getPostgresTypeName(oid: number): string {
    const typeMap: Record<number, string> = {
      16: 'boolean',
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      25: 'text',
      700: 'real',
      701: 'double precision',
      1043: 'varchar',
      1082: 'date',
      1114: 'timestamp',
      1184: 'timestamptz',
      1700: 'numeric',
      2950: 'uuid',
    };
    return typeMap[oid] || `type(${oid})`;
  }

  async executeTableQuery(
    sql: string,
    page: number = 1,
    pageSize: number = 25,
    sort?: string,
    userId?: string,
  ): Promise<QueryResult> {
    // Validate SQL using the new SQLSelectGuard
    try {
      SQLSelectGuard.assertSafeSelect(sql);
    } catch (error) {
      if (error instanceof Error) {
        throw new CustomError(error.message, 400);
      }
      throw new CustomError('SQL validation failed', 400);
    }

    const config = await this.getExternalDatabaseConfig(userId);
    const pool = await this.getExternalPool(config);
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();
      
      // Set statement timeout to prevent long-running queries
      await client.query('SET statement_timeout = 30000'); // 30 seconds

      // Extract LIMIT from user's query if present
      const limitMatch = sql.trim().match(/\s+LIMIT\s+(\d+)(?:\s+OFFSET\s+\d+)?(?:\s*;)?$/i);
      const userLimit = limitMatch && limitMatch[1] ? parseInt(limitMatch[1]) : null;
      
      // Strip any existing LIMIT/OFFSET from the user's query
      const cleanedSql = sql.trim().replace(/;$/, '').replace(/\s+LIMIT\s+\d+(?:\s+OFFSET\s+\d+)?$/i, '');

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM (${cleanedSql}) as count_query`;
      const countResult = await client.query(countSql);
      const total = countResult.rows && countResult.rows.length > 0 
        ? parseInt(countResult.rows[0].total) 
        : 0;

      // Use user's LIMIT if it's smaller than pageSize, otherwise use pageSize
      const effectiveLimit = userLimit !== null && userLimit < pageSize ? userLimit : pageSize;
      
      // Apply pagination
      const offset = (page - 1) * effectiveLimit;
      const paginatedSql = `${cleanedSql} LIMIT ${effectiveLimit} OFFSET ${offset}`;

      const result = await client.query(paginatedSql);

      // Extract columns and rows
      const columns = result.rows && result.rows.length > 0 ? Object.keys(result.rows[0]) : [];
      
      // Convert BigInt values to strings for JSON serialization
      const rows = (result.rows || []).map((row: any) => {
        const convertedRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          convertedRow[key] = typeof value === 'bigint' ? value.toString() : value;
        }
        return convertedRow;
      });

      // Get column types from the result metadata
      const columnTypes: Record<string, string> = {};
      if (result.fields) {
        result.fields.forEach((field: any) => {
          const typeName = field.dataTypeID ? this.getPostgresTypeName(field.dataTypeID) : 'unknown';
          columnTypes[field.name] = typeName;
        });
      }

      logger.info('Table query executed successfully', {
        sql: sql.substring(0, 100) + '...',
        totalRows: total,
        returnedRows: rows.length,
        page,
        pageSize: effectiveLimit,
      });

      return {
        columns,
        rows,
        columnTypes,
        total,
        page,
        pageSize: effectiveLimit,
      };
    } catch (error: any) {
      logger.error('Database query error:', {
        error: error.message,
        sql: sql.substring(0, 100) + '...',
        code: error.code,
        position: error.position,
      });

      // Build detailed error message for user
      let userMessage = error.message;
      if (error.code) {
        userMessage = `[${error.code}] ${userMessage}`;
      }
      if (error.position) {
        userMessage += ` at position ${error.position}`;
      }

      throw new CustomError(userMessage, 400);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async executeTileQuery(sql: string, userId?: string): Promise<TileResult> {
    // Validate SQL using the new SQLSelectGuard
    try {
      SQLSelectGuard.assertSafeSelect(sql);
    } catch (error) {
      if (error instanceof Error) {
        throw new CustomError(error.message, 400);
      }
      throw new CustomError('SQL validation failed', 400);
    }

    const config = await this.getExternalDatabaseConfig(userId);
    const pool = await this.getExternalPool(config);
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();
      
      // Set statement timeout to prevent long-running queries
      await client.query('SET statement_timeout = 30000'); // 30 seconds

      // Execute query with LIMIT 1 enforced
      const safeSql = sql.trim().replace(/;$/, '') + ' LIMIT 1';
      const result = await client.query(safeSql);

      // Extract first value
      let value: number | null = null;
      if (result.rows && result.rows.length > 0) {
        const firstRow = result.rows[0];
        const firstValue = Object.values(firstRow)[0];
        
        // Handle BigInt conversion
        if (typeof firstValue === 'bigint') {
          value = Number(firstValue);
        } else if (typeof firstValue === 'number') {
          value = firstValue;
        } else if (typeof firstValue === 'string' && !isNaN(parseFloat(firstValue))) {
          value = parseFloat(firstValue);
        } else if (firstValue === null) {
          value = null;
        }
      }

      logger.info('Tile query executed successfully', {
        sql: sql.substring(0, 100) + '...',
        value,
      });

      return { value };
    } catch (error: any) {
      logger.error('Database tile query error:', {
        error: error.message,
        sql: sql.substring(0, 100) + '...',
        code: error.code,
        position: error.position,
      });

      // Build detailed error message for user
      let userMessage = error.message;
      if (error.code) {
        userMessage = `[${error.code}] ${userMessage}`;
      }
      if (error.position) {
        userMessage += ` at position ${error.position}`;
      }

      throw new CustomError(userMessage, 400);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // ==========================================
  // App Data Methods (Reports, Sections, etc.)
  // ==========================================

  async getSections(pool?: Pool): Promise<any[]> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        // First check if the function exists, if not use simple query
        const functionCheck = await client.query(
          `SELECT EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' AND p.proname = 'get_section_hierarchy'
          )`
        );
        
        if (functionCheck.rows[0].exists) {
          const result = await client.query(`SELECT * FROM get_section_hierarchy()`);
          return result.rows;
        } else {
          // Fallback to simple query
          const result = await client.query(
            'SELECT * FROM public.sections ORDER BY sort_order'
          );
          return result.rows;
        }
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting sections:', error);
      throw new CustomError('Failed to get sections', 500);
    }
  }

  async getReports(pool?: Pool): Promise<any[]> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        const result = await client.query(`
          SELECT r.*, s.name as section_name 
          FROM public.reports r 
          LEFT JOIN public.sections s ON r.section_id = s.id 
          ORDER BY s.sort_order, r.sort_order
        `);

        // Parse report_schema JSONB fields for all reports
        const reports = result.rows.map(report => {
          if (report.report_schema && typeof report.report_schema === 'string') {
            try {
              report.report_schema = JSON.parse(report.report_schema);
            } catch (parseError) {
              logger.warn('Failed to parse report_schema JSON:', parseError);
              // Keep as string if parsing fails
            }
          }
          return report;
        });

        return reports;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting reports:', error);
      throw new CustomError('Failed to get reports', 500);
    }
  }

  async getReportById(id: string, pool?: Pool): Promise<any> {
    const dbPool = pool || this.appPool;
    try {
      const client = await dbPool.connect();
      
      try {
        const result = await client.query(
          `SELECT r.*, s.name as section_name 
           FROM public.reports r 
           LEFT JOIN public.sections s ON r.section_id = s.id 
           WHERE r.id = $1`,
          [id]
        );

        if (result.rows.length === 0) {
          return null;
        }

        const report = result.rows[0];
        
        // Parse the report_schema JSONB field if it exists
        if (report.report_schema && typeof report.report_schema === 'string') {
          try {
            report.report_schema = JSON.parse(report.report_schema);
          } catch (parseError) {
            logger.warn('Failed to parse report_schema JSON:', parseError);
            // Keep as string if parsing fails
          }
        }

        return report;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting report:', error);
      throw new CustomError('Failed to get report', 500);
    }
  }

  async closeAllConnections(): Promise<void> {
    await this.appPool.end();
    logger.info('Closed app database pool');

    for (const [key, pool] of this.externalPools) {
      await pool.end();
      logger.info(`Closed external database pool: ${key}`);
    }
    this.externalPools.clear();
  }

  /**
   * Transform date/timestamp values to user's timezone
   * This is applied AFTER SQL execution, so no SQL injection risk
   */
  private transformToUserTimezone(value: any, columnType: string, userTimezone: string): any {
    // Only transform date/timestamp types
    if (columnType !== 'timestamp' && columnType !== 'timestamptz' && columnType !== 'date') {
      return value;
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // PostgreSQL returns timestamps as Date objects or ISO strings
    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      date = new Date(value);
    } else {
      // If it's not a date-like value, return as-is
      return value;
    }

    // Validate date
    if (isNaN(date.getTime())) {
      return value; // Return original if invalid date
    }

    // Convert to user's timezone
    // Return ISO string with timezone information preserved
    try {
      // Format as ISO string but in user's timezone
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(date);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      const hour = parts.find(p => p.type === 'hour')?.value;
      const minute = parts.find(p => p.type === 'minute')?.value;
      const second = parts.find(p => p.type === 'second')?.value;

      // For date type, return date only
      if (columnType === 'date') {
        return `${year}-${month}-${day}`;
      }

      // For timestamp types, return datetime
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    } catch (error) {
      // If timezone conversion fails, return original value
      logger.warn('Failed to convert timezone, returning original value:', error);
      return value;
    }
  }

  /**
   * Execute parameterized SQL query with typed parameters
   * @param userId - User ID for fetching timezone preferences and database connection from user metadata (optional, defaults to UTC)
   */
  async executeParameterizedQuery(
    statement: string,
    params: Record<string, unknown>,
    timeoutMs: number = 30000,
    maxRows: number = 10000,
    userId?: string,
    pagination?: { page: number; pageSize: number }
  ): Promise<ParameterizedQueryResult> {
    const startTime = Date.now();

    // Validate SQL template (with ${variable_name} placeholders) - less strict
    try {
      SQLSelectGuard.assertSafeTemplate(statement);
    } catch (error) {
      if (error instanceof Error) {
        throw new CustomError(`SQL template validation failed: ${error.message}`, 400);
      }
      throw new CustomError('SQL template validation failed', 400);
    }

    // Fetch user timezone preferences (if userId provided)
    let userTimezone = 'UTC';
    if (userId) {
      try {
        const preferences = await this.getUserPreferences(userId);
        if (preferences?.timezone) {
          userTimezone = preferences.timezone;
        }
      } catch (error) {
        // Log but don't fail - default to UTC
        logger.warn('Failed to fetch user preferences, using UTC:', error);
      }
    }

    const config = await this.getExternalDatabaseConfig(userId);
    const pool = await this.getExternalPool(config);
    let client: PoolClient | null = null;

    try {
      client = await pool.connect();
      
      // Set statement timeout
      await client.query(`SET statement_timeout = ${timeoutMs}`);

      // Check if there are any parameters to process
      const hasParameters = Object.keys(params).length > 0;
      
      let processedStatement = statement;
      let paramValues: unknown[] = [];
      let usedParamCount = 0;

      if (hasParameters) {
        // Convert parameters to PostgreSQL format
        // Only include parameters that are actually used in the SQL
        // Uses ${variable_name} syntax (Grafana-style template variables)
        Object.entries(params).forEach(([name, value]) => {
          // Check if this parameter is used in the SQL
          // Escape special regex characters in paramName
          const escapedParamName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const paramPattern = new RegExp(`\\$\\{${escapedParamName}\\}`, 'g');
          if (paramPattern.test(processedStatement)) {
            usedParamCount++;
            const placeholder = `$${usedParamCount}`;
            processedStatement = processedStatement.replace(
              paramPattern, 
              placeholder
            );
            paramValues.push(value);
          }
        });
      }

      // Validate SQL again after parameter binding to ensure final SQL is safe
      // This happens BEFORE execution, as requested
      try {
        SQLSelectGuard.assertSafeSelect(processedStatement);
      } catch (error) {
        if (error instanceof Error) {
          throw new CustomError(`SQL validation failed after parameter binding: ${error.message}`, 400);
        }
        throw new CustomError('SQL validation failed after parameter binding', 400);
      }

      let total = 0;
      let finalStatement = processedStatement;
      let finalParamValues = paramValues;

      // Handle pagination if requested
      if (pagination) {
        const { page, pageSize } = pagination;
        
        // Validate pagination parameters
        if (page < 1 || pageSize < 1 || pageSize > 10000) {
          throw new CustomError('Invalid pagination parameters. Page must be >= 1 and pageSize must be between 1 and 10000', 400);
        }

        // Strip any existing LIMIT/OFFSET from the query
        const cleanedStatement = processedStatement.trim().replace(/;$/, '').replace(/\s+LIMIT\s+\d+(?:\s+OFFSET\s+\d+)?$/i, '');
        
        // Get total count (wrap query in COUNT)
        // Note: This COUNT query will use the same parameterized values
        const countStatement = `SELECT COUNT(*) as total FROM (${cleanedStatement}) as count_query`;
        const countResult = usedParamCount > 0
          ? await client.query(countStatement, paramValues)
          : await client.query(countStatement);
        
        total = countResult.rows && countResult.rows.length > 0 
          ? parseInt(countResult.rows[0].total as string, 10) 
          : 0;

        // Apply pagination with LIMIT/OFFSET
        const offset = (page - 1) * pageSize;
        finalStatement = `${cleanedStatement} LIMIT ${pageSize} OFFSET ${offset}`;
        // Note: LIMIT and OFFSET are safe integers, not user input
      } else {
        // No pagination - check for existing LIMIT clause
        const hasLimitClause = /\bLIMIT\s+\d+/i.test(processedStatement);
        if (!hasLimitClause) {
          // Apply maxRows limit if no LIMIT exists
          finalStatement = `${processedStatement.trim().replace(/;$/, '')} LIMIT ${maxRows}`;
        }
      }

      // Execute query
      // Only pass paramValues if there are actual parameters used in the SQL
      const result = usedParamCount > 0
        ? await client.query(finalStatement, finalParamValues)
        : await client.query(finalStatement);

      // Convert result to standardized format
      const columns = result.fields.map(field => ({
        name: field.name,
        type: this.getPostgresTypeName(field.dataTypeID)
      }));

      // Transform rows with timezone conversion
      // This happens AFTER SQL execution, so no SQL injection risk
      const rows = result.rows.map(row => {
        const rowArray = Object.values(row);
        return rowArray.map((value, index) => {
          // Convert BigInt to string for JSON serialization
          if (typeof value === 'bigint') {
            return value.toString();
          }
          
          // Apply timezone transformation for date/timestamp columns
          const columnType = columns[index]?.type;
          if (columnType && (columnType === 'timestamp' || columnType === 'timestamptz' || columnType === 'date')) {
            return this.transformToUserTimezone(value, columnType, userTimezone);
          }
          
          return value;
        });
      });

      // Enforce max rows limit only if not using pagination
      if (!pagination) {
        const hasLimitClause = /\bLIMIT\s+\d+/i.test(statement);
        if (!hasLimitClause && rows.length > maxRows) {
          throw new CustomError(
            `Query returned too many rows: ${rows.length} > ${maxRows}`,
            400
          );
        }
      }

      const elapsedMs = Date.now() - startTime;

      const resultData: ParameterizedQueryResult = {
        columns,
        rows,
        stats: {
          rowCount: pagination ? rows.length : rows.length,
          elapsedMs,
          usedParamCount
        }
      };

      // Add pagination metadata if pagination was requested
      if (pagination) {
        resultData.pagination = {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total
        };
      }

      return resultData;

    } catch (error: any) {
      logger.error('Parameterized query error:', {
        error: error.message,
        statement: statement.substring(0, 100) + '...',
        paramCount: Object.keys(params).length,
      });

      if (error instanceof CustomError) {
        throw error;
      }

      throw new CustomError(
        error.message || 'Query execution failed',
        error.code === 'ECONNREFUSED' ? 503 : 500
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }
}