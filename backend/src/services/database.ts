import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { logger } from '../utils/logger.js';
import { CustomError } from '../middleware/errorHandler.js';
import { SQLSelectGuard } from '../utils/sqlSelectGuard.js';
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
  private clientSettingsPools: Map<string, Pool> = new Map();
  private externalPools: Map<string, Pool> = new Map();

  constructor() {
    // Validate required environment variables
    if (!process.env.CLIENT_SETTINGS_DB_USER) {
      throw new Error('CLIENT_SETTINGS_DB_USER environment variable is required');
    }
    if (!process.env.CLIENT_SETTINGS_DB_PASSWORD) {
      throw new Error('CLIENT_SETTINGS_DB_PASSWORD environment variable is required');
    }

    logger.info('Database service initialized (client settings mode)');
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  static async initialize(): Promise<void> {
    // Just create the instance - no connection to test without iotDbUrl
    DatabaseService.getInstance();
    logger.info('Database service ready (will connect on first request)');
  }

  // ==========================================
  // Client Settings Pool Management
  // ==========================================

  /**
   * Parse a PostgreSQL URL and extract connection components
   */
  parsePostgresUrl(url: string): DatabaseConfig {
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

  /**
   * Build a client settings connection string from user's iotDbUrl
   * Uses CLIENT_SETTINGS_DB_USER and CLIENT_SETTINGS_DB_PASSWORD from env
   * with host/port/database from the iotDbUrl
   */
  buildClientSettingsConnectionString(iotDbUrl: string): string {
    const config = this.parsePostgresUrl(iotDbUrl);
    const settingsUser = process.env.CLIENT_SETTINGS_DB_USER!;
    const settingsPassword = process.env.CLIENT_SETTINGS_DB_PASSWORD!;
    
    return `postgresql://${encodeURIComponent(settingsUser)}:${encodeURIComponent(settingsPassword)}@${config.hostname}:${config.port}/${config.database}`;
  }

  /**
   * Get or create a client settings pool for the given iotDbUrl
   */
  getClientSettingsPool(iotDbUrl: string): Pool {
    const config = this.parsePostgresUrl(iotDbUrl);
    const poolKey = `${config.hostname}:${config.port}/${config.database}`;
    
    if (!this.clientSettingsPools.has(poolKey)) {
      const settingsUser = process.env.CLIENT_SETTINGS_DB_USER!;
      const settingsPassword = process.env.CLIENT_SETTINGS_DB_PASSWORD!;
      
      const pool = new Pool({
        user: settingsUser,
        password: settingsPassword,
        database: config.database,
        host: config.hostname,
        port: config.port,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.clientSettingsPools.set(poolKey, pool);
      logger.info('Created new client settings pool', { poolKey });
    }

    return this.clientSettingsPools.get(poolKey)!;
  }

  /**
   * Test client settings database connection
   */
  async testClientSettingsConnection(iotDbUrl: string): Promise<void> {
    const pool = this.getClientSettingsPool(iotDbUrl);
    let client: PoolClient | null = null;
    
    try {
      client = await pool.connect();
      await client.query('SELECT 1');
      logger.info('Client settings database connection successful');
    } catch (error) {
      logger.error('Failed to connect to client settings database:', error);
      throw new CustomError(
        `Failed to connect to client settings database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // ==========================================
  // Authentication Methods
  // ==========================================

  /**
   * Passwordless authentication for plugin mode
   * Creates or updates user in client database and returns JWT
   */
  async authenticateUserPasswordless(
    email: string,
    role: 'admin' | 'editor' | 'viewer',
    iotDbUrl: string
  ): Promise<{ user: User; token: string }> {
    const pool = this.getClientSettingsPool(iotDbUrl);
    
    try {
      const client = await pool.connect();
      
      try {
        // Check if user exists in client database (match by email)
        let result = await client.query(
          'SELECT * FROM dashboard_studio_meta_data.users WHERE email = $1',
          [email]
        );

        let user: User;
        let isNewUser = false;
        
        if (result.rows.length === 0) {
          // Create new user
          logger.info('Creating new user for passwordless auth', { email, role });
          const insertResult = await client.query(
            `INSERT INTO dashboard_studio_meta_data.users (email, email_confirmed_at, is_super_admin, raw_user_meta_data)
             VALUES ($1, NOW(), $2, $3)
             RETURNING *`,
            [email, role === 'admin', JSON.stringify({ iotDbUrl })]
          );
          user = insertResult.rows[0] as User;
          isNewUser = true;

          // Create user role
          await client.query('DELETE FROM dashboard_studio_meta_data.user_roles WHERE user_id = $1', [user.id]);
          await client.query('INSERT INTO dashboard_studio_meta_data.user_roles (user_id, role) VALUES ($1, $2)', [user.id, role]);
        } else {
          user = result.rows[0] as User;
          logger.info('Found existing user for passwordless auth', { email, userId: user.id, role });
          
          // Update user role
          await client.query('DELETE FROM dashboard_studio_meta_data.user_roles WHERE user_id = $1', [user.id]);
          await client.query('INSERT INTO dashboard_studio_meta_data.user_roles (user_id, role) VALUES ($1, $2)', [user.id, role]);
        }

        // Update last sign in and store iotDbUrl in metadata
        await client.query(
          'UPDATE dashboard_studio_meta_data.users SET last_sign_in_at = NOW(), raw_user_meta_data = $1 WHERE id = $2',
          [JSON.stringify({ iotDbUrl }), user.id]
        );
        
        logger.info('Updated user metadata with iotDbUrl', { 
          userId: user.id, 
          email,
          isNewUser
        });

        // Generate JWT token - include iotDbUrl for subsequent requests
        const token = jwt.sign(
          { 
            userId: user.id, 
            email: user.email,
            role: role,
            iotDbUrl: iotDbUrl
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '24h' }
        );

        return { user, token };
      } finally {
        client.release();
      }
    } catch (error: any) {
      // Log detailed error information for debugging
      logger.error('Passwordless authentication error:', {
        errorCode: error?.code,
        errorMessage: error?.message,
        errorDetail: error?.detail,
        errorHint: error?.hint,
        errorPosition: error?.position,
        errorStack: error?.stack,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      
      // Handle specific PostgreSQL error codes
      const errorCode = error?.code;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // 28P01: Authentication failed (invalid password for settings user)
      // 28000: Invalid authorization specification
      if (errorCode === '28P01' || errorCode === '28000') {
        throw new CustomError(
          'Dashboard settings schema is not configured for this database. Please contact your administrator to set up the dashboard_studio_meta_data schema.',
          403
        );
      }
      
      // 3D000: Database does not exist
      if (errorCode === '3D000') {
        throw new CustomError(
          'The specified database does not exist. Please check your connection URL.',
          400
        );
      }
      
      // ECONNREFUSED: Cannot connect to database
      if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
        throw new CustomError(
          'Cannot connect to the database server. Please check the host and port in your connection URL.',
          400
        );
      }
      
      // ENOTFOUND: Host not found
      if (errorCode === 'ENOTFOUND' || errorMessage.includes('ENOTFOUND')) {
        throw new CustomError(
          'Database host not found. Please check the hostname in your connection URL.',
          400
        );
      }
      
      // 42P01: Table does not exist (schema not set up)
      if (errorCode === '42P01') {
        throw new CustomError(
          'Dashboard settings tables are not configured. Please contact your administrator to set up the dashboard_studio_meta_data schema.',
          403
        );
      }
      
      // 3F000: Schema does not exist
      if (errorCode === '3F000' || errorMessage.includes('schema') && errorMessage.includes('does not exist')) {
        throw new CustomError(
          'Dashboard settings schema (dashboard_studio_meta_data) does not exist in this database. Please contact your administrator.',
          403
        );
      }
      
      throw new CustomError(
        `Authentication failed: ${errorMessage}`,
        500
      );
    }
  }

  async getUserRole(userId: string, pool: Pool): Promise<string> {
    try {
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          'SELECT role FROM dashboard_studio_meta_data.user_roles WHERE user_id = $1',
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

  async getUsers(pool: Pool): Promise<User[]> {
    try {
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          'SELECT * FROM dashboard_studio_meta_data.users ORDER BY created_at ASC'
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
  // Global Variables Methods
  // ==========================================

  async getGlobalVariables(pool: Pool): Promise<any[]> {
    try {
      const client = await pool.connect();
      
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
          'SELECT * FROM dashboard_studio_meta_data.global_variables ORDER BY label ASC'
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

  async getGlobalVariableById(id: string, pool: Pool): Promise<any | null> {
    try {
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          'SELECT * FROM dashboard_studio_meta_data.global_variables WHERE id = $1',
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
  }, pool: Pool): Promise<any> {
    try {
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          `INSERT INTO dashboard_studio_meta_data.global_variables (label, description, value)
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
  }, pool: Pool): Promise<any> {
    try {
      const client = await pool.connect();
      
      try {
        // Get existing variable
        const existing = await this.getGlobalVariableById(id, pool);
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
          `UPDATE dashboard_studio_meta_data.global_variables 
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

  async deleteGlobalVariable(id: string, pool: Pool): Promise<void> {
    try {
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          'DELETE FROM dashboard_studio_meta_data.global_variables WHERE id = $1',
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

  async getGlobalVariablesAsMap(pool: Pool): Promise<Record<string, string>> {
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
  // External Database Methods (for SQL queries)
  // ==========================================

  /**
   * Get user's IoT database URL from raw_user_meta_data
   */
  async getUserIotDbUrl(userId: string, pool: Pool): Promise<string | null> {
    try {
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          'SELECT raw_user_meta_data FROM dashboard_studio_meta_data.users WHERE id = $1',
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

  /**
   * Test database connection with provided settings
   */
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
        connectionTimeoutMillis: 10000,
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
        
        logger.error('Database connection test failed - detailed error:', {
          host: config.hostname,
          port: config.port,
          database: config.database,
          user: config.user,
          errorMessage,
          errorCode,
        });
        
        // Provide more helpful error messages
        let userFriendlyMessage = errorMessage;
        if (errorMessage.includes('ECONNREFUSED') || errorCode === 'ECONNREFUSED') {
          userFriendlyMessage = `Cannot connect to database at ${config.hostname}:${config.port}. Please ensure PostgreSQL is running and accessible from the backend server.`;
        } else if (errorMessage.includes('authentication failed') || errorMessage.includes('password') || errorCode === '28P01') {
          userFriendlyMessage = `Authentication failed. Please check your username and password.`;
        } else if (errorMessage.includes('does not exist') || errorCode === '3D000') {
          userFriendlyMessage = `Database "${config.database}" does not exist. Please check the database name.`;
        }
        
        throw new CustomError(`Failed to connect to database: ${userFriendlyMessage}`, 400);
      } finally {
        if (client) {
          client.release();
        }
        await testPool.end();
      }
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Unexpected error testing database connection:', error);
      throw new CustomError(
        `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        400
      );
    }
  }

  private async getExternalDatabaseConfig(iotDbUrl: string): Promise<DatabaseConfig> {
    return this.parsePostgresUrl(iotDbUrl);
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
    iotDbUrl?: string,
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

    if (!iotDbUrl) {
      throw new CustomError('iotDbUrl is required for query execution', 400);
    }

    const config = await this.getExternalDatabaseConfig(iotDbUrl);
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

  async executeTileQuery(sql: string, iotDbUrl?: string): Promise<TileResult> {
    // Validate SQL using the new SQLSelectGuard
    try {
      SQLSelectGuard.assertSafeSelect(sql);
    } catch (error) {
      if (error instanceof Error) {
        throw new CustomError(error.message, 400);
      }
      throw new CustomError('SQL validation failed', 400);
    }

    if (!iotDbUrl) {
      throw new CustomError('iotDbUrl is required for query execution', 400);
    }

    const config = await this.getExternalDatabaseConfig(iotDbUrl);
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

  async getSections(pool: Pool, userId?: string): Promise<any[]> {
    try {
      const client = await pool.connect();
      
      try {
        if (userId) {
          // Filter by user_id
          const result = await client.query(
            'SELECT * FROM dashboard_studio_meta_data.sections WHERE user_id = $1 AND is_deleted = FALSE ORDER BY sort_order',
            [userId]
          );
          return result.rows;
        } else {
          // First check if the function exists, if not use simple query
          const functionCheck = await client.query(
            `SELECT EXISTS (
              SELECT 1 FROM pg_proc p 
              JOIN pg_namespace n ON p.pronamespace = n.oid 
              WHERE n.nspname = 'dashboard_studio_meta_data' AND p.proname = 'get_section_hierarchy'
            )`
          );
          
          if (functionCheck.rows[0].exists) {
            const result = await client.query(`SELECT * FROM dashboard_studio_meta_data.get_section_hierarchy()`);
            return result.rows;
          } else {
            // Fallback to simple query
            const result = await client.query(
              'SELECT * FROM dashboard_studio_meta_data.sections WHERE is_deleted = FALSE ORDER BY sort_order'
            );
            return result.rows;
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting sections:', error);
      throw new CustomError('Failed to get sections', 500);
    }
  }

  async getReports(pool: Pool, userId?: string): Promise<any[]> {
    try {
      const client = await pool.connect();
      
      try {
        let result;
        if (userId) {
          // Filter by user_id
          result = await client.query(`
            SELECT r.*, s.name as section_name 
            FROM dashboard_studio_meta_data.reports r 
            LEFT JOIN dashboard_studio_meta_data.sections s ON r.section_id = s.id 
            WHERE r.user_id = $1 AND r.is_deleted = FALSE
            ORDER BY s.sort_order, r.sort_order
          `, [userId]);
        } else {
          result = await client.query(`
            SELECT r.*, s.name as section_name 
            FROM dashboard_studio_meta_data.reports r 
            LEFT JOIN dashboard_studio_meta_data.sections s ON r.section_id = s.id 
            WHERE r.is_deleted = FALSE
            ORDER BY s.sort_order, r.sort_order
          `);
        }

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

  async getReportById(id: string, pool: Pool, userId?: string): Promise<any> {
    try {
      const client = await pool.connect();
      
      try {
        let result;
        if (userId) {
          // Filter by user_id for security
          result = await client.query(
            `SELECT r.*, s.name as section_name 
             FROM dashboard_studio_meta_data.reports r 
             LEFT JOIN dashboard_studio_meta_data.sections s ON r.section_id = s.id 
             WHERE r.id = $1 AND r.user_id = $2 AND r.is_deleted = FALSE`,
            [id, userId]
          );
        } else {
          result = await client.query(
            `SELECT r.*, s.name as section_name 
             FROM dashboard_studio_meta_data.reports r 
             LEFT JOIN dashboard_studio_meta_data.sections s ON r.section_id = s.id 
             WHERE r.id = $1 AND r.is_deleted = FALSE`,
            [id]
          );
        }

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
    // Close all client settings pools
    for (const [key, pool] of this.clientSettingsPools) {
      await pool.end();
      logger.info(`Closed client settings pool: ${key}`);
    }
    this.clientSettingsPools.clear();

    // Close all external pools
    for (const [key, pool] of this.externalPools) {
      await pool.end();
      logger.info(`Closed external database pool: ${key}`);
    }
    this.externalPools.clear();
  }

  /**
   * Execute parameterized SQL query with typed parameters
   * @param iotDbUrl - User's IoT database URL for query execution
   * @param settingsPool - Pool for fetching user settings (optional, for global variables)
   */
  async executeParameterizedQuery(
    statement: string,
    params: Record<string, unknown>,
    timeoutMs: number = 30000,
    maxRows: number = 10000,
    iotDbUrl?: string,
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

    if (!iotDbUrl) {
      throw new CustomError('iotDbUrl is required for query execution', 400);
    }

    const config = await this.getExternalDatabaseConfig(iotDbUrl);
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
      } else {
        // No pagination - check for existing LIMIT clause
        const hasLimitClause = /\bLIMIT\s+\d+/i.test(processedStatement);
        if (!hasLimitClause) {
          // Apply maxRows limit if no LIMIT exists
          finalStatement = `${processedStatement.trim().replace(/;$/, '')} LIMIT ${maxRows}`;
        }
      }

      // Execute query
      const result = usedParamCount > 0
        ? await client.query(finalStatement, finalParamValues)
        : await client.query(finalStatement);

      // Convert result to standardized format
      const columns = result.fields.map(field => ({
        name: field.name,
        type: this.getPostgresTypeName(field.dataTypeID)
      }));

      // Transform rows
      const rows = result.rows.map(row => {
        const rowArray = Object.values(row);
        return rowArray.map((value) => {
          // Convert BigInt to string for JSON serialization
          if (typeof value === 'bigint') {
            return value.toString();
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
          rowCount: rows.length,
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
