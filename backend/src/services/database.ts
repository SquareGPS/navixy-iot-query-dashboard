import { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { logger } from '../utils/logger.js';
import { CustomError } from '../middleware/errorHandler.js';
import { SQLSelectGuard } from '../utils/sqlSelectGuard.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
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

  // ==========================================
  // Authentication Methods
  // ==========================================

  async authenticateUser(email: string, password: string): Promise<{ user: User; token: string } | null> {
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
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
          return null;
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
            role: await this.getUserRole(user.id)
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '24h' }
        );

        return { user, token };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Authentication error:', error);
      throw new CustomError('Authentication failed', 500);
    }
  }

  async getUserRole(userId: string): Promise<string> {
    try {
      const client = await this.appPool.connect();
      
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

  async createUser(email: string, password: string, role: string = 'viewer'): Promise<User> {
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

  async getAppSettings(): Promise<any> {
    try {
      const client = await this.appPool.connect();
      
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

  async updateAppSettings(settings: any): Promise<void> {
    try {
      const client = await this.appPool.connect();
      
      try {
        await client.query(
          `UPDATE public.app_settings 
           SET organization_name = $1, timezone = $2, external_db_url = $3,
               external_db_host = $4, external_db_port = $5, external_db_name = $6,
               external_db_user = $7, external_db_password = $8, external_db_ssl = $9
           WHERE id = 1`,
          [
            settings.organization_name,
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
  // External Database Methods
  // ==========================================

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

  private async getExternalDatabaseConfig(): Promise<DatabaseConfig> {
    try {
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
    const urlObj = new URL(url);
    const sslmode = urlObj.searchParams.get('sslmode');
    
    return {
      user: decodeURIComponent(urlObj.username),
      password: decodeURIComponent(urlObj.password),
      database: urlObj.pathname.slice(1),
      hostname: urlObj.hostname,
      port: parseInt(urlObj.port) || 5432,
      ssl: sslmode === 'require',
    };
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

    const config = await this.getExternalDatabaseConfig();
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

  async executeTileQuery(sql: string): Promise<TileResult> {
    // Validate SQL using the new SQLSelectGuard
    try {
      SQLSelectGuard.assertSafeSelect(sql);
    } catch (error) {
      if (error instanceof Error) {
        throw new CustomError(error.message, 400);
      }
      throw new CustomError('SQL validation failed', 400);
    }

    const config = await this.getExternalDatabaseConfig();
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

  async getSections(): Promise<any[]> {
    try {
      const client = await this.appPool.connect();
      
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
            'SELECT * FROM public.sections ORDER BY sort_index'
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

  async getReports(): Promise<any[]> {
    try {
      const client = await this.appPool.connect();
      
      try {
        const result = await client.query(`
          SELECT r.*, s.name as section_name 
          FROM public.reports r 
          LEFT JOIN public.sections s ON r.section_id = s.id 
          ORDER BY s.sort_index, r.sort_index
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

  async getReportById(id: string): Promise<any> {
    try {
      const client = await this.appPool.connect();
      
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
   * Execute parameterized SQL query with typed parameters
   */
  async executeParameterizedQuery(
    statement: string,
    params: Record<string, unknown>,
    timeoutMs: number = 30000,
    maxRows: number = 10000
  ): Promise<ParameterizedQueryResult> {
    const startTime = Date.now();

    // Validate SQL using the new SQLSelectGuard
    try {
      SQLSelectGuard.assertSafeSelect(statement);
    } catch (error) {
      if (error instanceof Error) {
        throw new CustomError(error.message, 400);
      }
      throw new CustomError('SQL validation failed', 400);
    }

    const config = await this.getExternalDatabaseConfig();
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
        Object.entries(params).forEach(([name, value]) => {
          // Check if this parameter is used in the SQL
          const paramPattern = new RegExp(`:${name}\\b`, 'g');
          if (paramPattern.test(processedStatement)) {
            usedParamCount++;
            const placeholder = `$${usedParamCount}`;
            processedStatement = processedStatement.replace(
              new RegExp(`:${name}\\b`, 'g'), 
              placeholder
            );
            paramValues.push(value);
          }
        });
      }

      // Execute query
      // Only pass paramValues if there are actual parameters used in the SQL
      const result = usedParamCount > 0
        ? await client.query(processedStatement, paramValues)
        : await client.query(processedStatement);

      // Convert result to standardized format
      const columns = result.fields.map(field => ({
        name: field.name,
        type: this.getPostgresTypeName(field.dataTypeID)
      }));

      const rows = result.rows.map(row => 
        Object.values(row).map(value => {
          // Convert BigInt to string for JSON serialization
          if (typeof value === 'bigint') {
            return value.toString();
          }
          return value;
        })
      );

      // Enforce max rows limit - but only if the SQL doesn't already have a LIMIT clause
      // If SQL has LIMIT, respect it; otherwise apply our maxRows limit
      const hasLimitClause = /\bLIMIT\s+\d+/i.test(statement);
      if (!hasLimitClause && rows.length > maxRows) {
        throw new CustomError(
          `Query returned too many rows: ${rows.length} > ${maxRows}`,
          400
        );
      }

      const elapsedMs = Date.now() - startTime;

      return {
        columns,
        rows,
        stats: {
          rowCount: rows.length,
          elapsedMs,
          usedParamCount
        }
      };

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