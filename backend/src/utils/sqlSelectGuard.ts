import { createRequire } from 'module';
import { logger } from './logger.js';

const require = createRequire(import.meta.url);
const { Parser } = require('node-sql-parser');

export interface ValidationIssue {
  code: string;
  message: string;
}

export class SelectValidationError extends Error {
  public readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    const message = issues.map(issue => `[${issue.code}] ${issue.message}`).join('; ');
    super(message);
    this.issues = issues;
    this.name = 'SelectValidationError';
  }
}

export class SQLSelectGuard {
  private static parser = new Parser();
  
  private static readonly BLOCKED_FUNCTIONS = [
    'pg_sleep',
    'pg_terminate_backend',
    'pg_cancel_backend',
    'pg_read_file',
    'pg_read_binary_file',
    'pg_write_file',
    'lo_import',
    'lo_export',
    'dblink_connect',
    'dblink_connect_u',
    'pg_logdir_ls',
    'pg_ls_dir',
    'pg_stat_file',
    'pg_reload_conf',
    'pg_rotate_logfile',
    'current_user',
    'session_user',
    'user',
    'current_database',
    'current_schema',
    'current_schemas',
    'version',
    'has_database_privilege',
    'has_schema_privilege',
    'has_table_privilege',
    'has_column_privilege',
    'has_function_privilege',
    'has_language_privilege',
    'has_sequence_privilege',
    'has_tablespace_privilege',
    'has_type_privilege'
  ];

  /**
   * Parse & validate SQL using node-sql-parser.
   * Raises SelectValidationError with one or more ValidationIssue if invalid.
   * Returns None if safe.
   */
  static assertSafeSelect(sql: string): void {
    const issues: ValidationIssue[] = [];

    try {
      // Clean and validate input
      const cleanSql = this.cleanSql(sql);
      if (!cleanSql.trim()) {
        issues.push({
          code: 'EMPTY_QUERY',
          message: 'SQL query cannot be empty'
        });
        throw new SelectValidationError(issues);
      }

      // Rule 1: Check for multiple statements
      if (this.hasMultipleStatements(cleanSql)) {
        issues.push({
          code: 'MULTI_STATEMENT',
          message: 'Only single statements are allowed'
        });
        throw new SelectValidationError(issues);
      }

      // Rule 2: Must start with SELECT
      if (!this.isSelectStatement(cleanSql)) {
        issues.push({
          code: 'NOT_SELECT',
          message: 'Only SELECT queries are allowed'
        });
        throw new SelectValidationError(issues);
      }

      // Rule 3: No SELECT INTO
      if (this.hasSelectInto(cleanSql)) {
        issues.push({
          code: 'SELECT_INTO',
          message: 'SELECT INTO statements are not allowed'
        });
        throw new SelectValidationError(issues);
      }

      // Rule 4: No row-locking variants
      if (this.hasLockingClause(cleanSql)) {
        issues.push({
          code: 'LOCKING',
          message: 'Row locking clauses (FOR UPDATE, FOR SHARE, etc.) are not allowed'
        });
        throw new SelectValidationError(issues);
      }

      // Rule 5: Block dangerous functions
      const functionIssues = this.validateFunctions(cleanSql);
      issues.push(...functionIssues);

      // Rule 6: Validate CTEs
      const cteIssues = this.validateCTEs(cleanSql);
      issues.push(...cteIssues);

      // Try to parse the SQL to catch syntax errors
      try {
        const ast = this.parser.astify(cleanSql);
        
        // Additional AST-based validation
        const astIssues = this.validateAST(ast);
        issues.push(...astIssues);
        
      } catch (parseError: any) {
        // Check if it's PostgreSQL-specific syntax that we should allow
        if (!this.isPostgreSQLSyntax(cleanSql)) {
          issues.push({
            code: 'PARSE_ERROR',
            message: `Invalid SQL syntax: ${parseError.message}`
          });
        }
      }

      if (issues.length > 0) {
        throw new SelectValidationError(issues);
      }

    } catch (error) {
      if (error instanceof SelectValidationError) {
        throw error;
      }

      // Handle unexpected errors
      logger.warn('SQL validation error:', {
        error: error instanceof Error ? error.message : String(error),
        sql: sql.substring(0, 100) + '...'
      });

      issues.push({
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown validation error'
      });

      throw new SelectValidationError(issues);
    }
  }

  /**
   * Check if SQL has multiple statements
   */
  private static hasMultipleStatements(sql: string): boolean {
    // Remove comments first
    const cleanSql = sql.replace(/--[^\n]*(\n|$)/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Count semicolons that are not at the end
    const trimmed = cleanSql.trim();
    if (trimmed.endsWith(';')) {
      const withoutSemicolon = trimmed.slice(0, -1);
      return withoutSemicolon.includes(';');
    }
    
    return cleanSql.includes(';');
  }

  /**
   * Check if SQL is a SELECT statement
   */
  private static isSelectStatement(sql: string): boolean {
    const trimmed = sql.trim().toUpperCase();
    return trimmed.startsWith('SELECT') || 
           trimmed.startsWith('WITH') ||
           trimmed.startsWith('(SELECT');
  }

  /**
   * Check for SELECT INTO statements
   */
  private static hasSelectInto(sql: string): boolean {
    const upperSql = sql.toUpperCase();
    return /\bSELECT\b.*\bINTO\b/i.test(sql) && !upperSql.includes('INTO TEMP');
  }

  /**
   * Check for row-locking clauses
   */
  private static hasLockingClause(sql: string): boolean {
    const lockingRegex = /\bFOR\s+(UPDATE|NO\s+KEY\s+UPDATE|SHARE|KEY\s+SHARE)\b/i;
    return lockingRegex.test(sql);
  }

  /**
   * Validate that no dangerous functions are used
   */
  private static validateFunctions(sql: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const upperSql = sql.toUpperCase();

    for (const func of this.BLOCKED_FUNCTIONS) {
      const regex = new RegExp(`\\b${func.toUpperCase()}\\b`, 'i');
      if (regex.test(sql)) {
        issues.push({
          code: 'BLOCKED_FUNC',
          message: `Function '${func}' is not allowed`
        });
      }
    }

    return issues;
  }

  /**
   * Validate CTEs to ensure they only contain SELECT statements
   */
  private static validateCTEs(sql: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const upperSql = sql.toUpperCase();

    // Check for WITH clauses
    if (upperSql.includes('WITH ')) {
      // This is a simplified check - in a real implementation, you'd parse the CTEs
      // For now, we'll block any WITH clause that contains non-SELECT keywords
      const dangerousKeywords = [
        'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
        'TRUNCATE', 'GRANT', 'REVOKE', 'COPY', 'EXECUTE', 'CALL'
      ];

      for (const keyword of dangerousKeywords) {
        const regex = new RegExp(`\\bWITH\\b[\\s\\S]*?\\b${keyword}\\b`, 'i');
        if (regex.test(sql)) {
          issues.push({
            code: 'NON_SELECT_CTE',
            message: `CTE contains prohibited operation: ${keyword}`
          });
          break; // Only report the first violation
        }
      }
    }

    return issues;
  }

  /**
   * Validate AST for additional security checks
   */
  private static validateAST(ast: any): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const astString = JSON.stringify(ast).toUpperCase();

    // Check for dangerous operations in AST
    const dangerousKeywords = [
      'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
      'TRUNCATE', 'GRANT', 'REVOKE', 'COPY', 'EXECUTE', 'CALL'
    ];

    for (const keyword of dangerousKeywords) {
      if (astString.includes(keyword)) {
        issues.push({
          code: 'DANGEROUS_OPERATION',
          message: `Prohibited operation detected: ${keyword}`
        });
        break;
      }
    }

    return issues;
  }

  /**
   * Check if SQL contains PostgreSQL-specific syntax that should be allowed
   */
  private static isPostgreSQLSyntax(sql: string): boolean {
    const postgresqlPatterns = [
      /INTERVAL\s+['"][^'"]*['"]/i,
      /NOW\(\)\s*-\s*INTERVAL/i,
      /CURRENT_TIMESTAMP\s*-\s*INTERVAL/i,
      /CURRENT_TIME\s*-\s*INTERVAL/i,
      /AT\s+TIME\s+ZONE/i,
      /::\s*\w+/i, // Type casting
      /ILIKE/i,
      /SIMILAR\s+TO/i,
      /DISTINCT\s+ON/i,
      /WINDOW\s+\w+/i,
      /OVER\s*\(/i,
      /PARTITION\s+BY/i,
      /ORDER\s+BY.*NULLS\s+(FIRST|LAST)/i,
      /RETURNING/i,
      /ON\s+CONFLICT/i,
      /UPSERT/i,
      /EXCLUDE/i,
      /GENERATED\s+ALWAYS/i,
      /GENERATED\s+BY\s+DEFAULT/i,
      /IDENTITY/i,
      /SERIAL/i,
      /BIGSERIAL/i,
      /SMALLSERIAL/i,
      /UUID/i,
      /JSONB/i,
      /JSON/i,
      /ARRAY/i,
      /HSTORE/i,
      /LTREE/i,
      /CITEXT/i,
      /INET/i,
      /CIDR/i,
      /MACADDR/i,
      /POINT/i,
      /POLYGON/i,
      /CIRCLE/i,
      /PATH/i,
      /BOX/i,
      /LINE/i,
      /LSEG/i,
      /TSQUERY/i,
      /TSVECTOR/i,
      /XML/i,
      /RANGE/i,
      /MULTIRANGE/i,
    ];

    return postgresqlPatterns.some(pattern => pattern.test(sql));
  }

  /**
   * Clean SQL input by removing comments and normalizing whitespace
   */
  private static cleanSql(sql: string): string {
    // Remove SQL comments
    let cleanSql = sql.replace(/--[^\n]*(\n|$)/g, '\n');
    cleanSql = cleanSql.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Normalize whitespace
    cleanSql = cleanSql.replace(/\s+/g, ' ').trim();
    
    // Remove trailing semicolon
    cleanSql = cleanSql.replace(/;$/, '');
    
    return cleanSql;
  }

  /**
   * Validate SQL and return validation result (non-throwing version)
   */
  static validate(sql: string): { valid: boolean; issues: ValidationIssue[] } {
    try {
      this.assertSafeSelect(sql);
      return { valid: true, issues: [] };
    } catch (error) {
      if (error instanceof SelectValidationError) {
        return { valid: false, issues: error.issues };
      }
      return {
        valid: false,
        issues: [{
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown validation error'
        }]
      };
    }
  }
}
