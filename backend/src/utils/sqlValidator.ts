import { createRequire } from 'module';
import { logger } from './logger.js';

const require = createRequire(import.meta.url);
const { Parser } = require('node-sql-parser');

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class SQLValidator {
  private static parser = new Parser();

  static validate(sql: string): ValidationResult {
    try {
      // Remove comments
      let cleanSql = sql.replace(/--[^\n]*(\n|$)/g, '\n');
      cleanSql = cleanSql.replace(/\/\*[\s\S]*?\*\//g, '');
      
      const trimmedSql = cleanSql.trim();
      
      if (!trimmedSql) {
        return { valid: false, error: 'SQL query cannot be empty' };
      }

      // Must start with SELECT
      if (!trimmedSql.toUpperCase().startsWith('SELECT')) {
        return { valid: false, error: 'Only SELECT queries are allowed' };
      }

      // Check for multiple statements
      if (trimmedSql.includes(';') && trimmedSql.lastIndexOf(';') !== trimmedSql.length - 1) {
        return { valid: false, error: 'Multiple statements are not allowed' };
      }

      // Parse SQL to validate syntax and check for dangerous operations
      const ast = this.parser.astify(trimmedSql);
      
      // Check for dangerous operations in the AST
      const dangerousCheck = this.checkForDangerousOperations(ast);
      if (!dangerousCheck.valid) {
        return dangerousCheck;
      }

      // Additional security checks
      const securityCheck = this.performSecurityChecks(trimmedSql);
      if (!securityCheck.valid) {
        return securityCheck;
      }

      return { valid: true };
    } catch (error: any) {
      logger.warn('SQL validation error:', {
        error: error.message,
        sql: sql.substring(0, 100) + '...',
      });
      
      return { 
        valid: false, 
        error: `Invalid SQL syntax: ${error.message}` 
      };
    }
  }

  private static checkForDangerousOperations(ast: any): ValidationResult {
    // Block dangerous keywords using word boundaries
    const dangerousKeywords = [
      'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 
      'TRUNCATE', 'GRANT', 'REVOKE', 'COPY', 'EXECUTE', 'CALL',
      'pg_read_file', 'pg_write_file', 'pg_sleep', 'pg_terminate_backend',
      'REPLACE', 'MERGE', 'UPSERT'
    ];

    const sqlString = JSON.stringify(ast).toUpperCase();
    
    for (const keyword of dangerousKeywords) {
      if (sqlString.includes(keyword)) {
        return { valid: false, error: `Prohibited operation: ${keyword}` };
      }
    }

    // Block CTEs that could hide write operations
    if (sqlString.includes('WITH ')) {
      return { valid: false, error: 'Common Table Expressions (WITH) are not allowed' };
    }

    // Block subqueries that might contain dangerous operations
    if (this.containsDangerousSubqueries(ast)) {
      return { valid: false, error: 'Subqueries containing dangerous operations are not allowed' };
    }

    return { valid: true };
  }

  private static containsDangerousSubqueries(ast: any): boolean {
    if (!ast || typeof ast !== 'object') {
      return false;
    }

    // Check for subqueries in FROM, WHERE, HAVING clauses
    const dangerousClauses = ['from', 'where', 'having'];
    
    for (const clause of dangerousClauses) {
      if (ast[clause]) {
        const clauseStr = JSON.stringify(ast[clause]).toUpperCase();
        const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE'];
        
        for (const keyword of dangerousKeywords) {
          if (clauseStr.includes(keyword)) {
            return true;
          }
        }
      }
    }

    // Recursively check nested structures
    for (const key in ast) {
      if (Array.isArray(ast[key])) {
        for (const item of ast[key]) {
          if (this.containsDangerousSubqueries(item)) {
            return true;
          }
        }
      } else if (typeof ast[key] === 'object') {
        if (this.containsDangerousSubqueries(ast[key])) {
          return true;
        }
      }
    }

    return false;
  }

  private static performSecurityChecks(sql: string): ValidationResult {
    const upperSql = sql.toUpperCase();

    // Block system functions that could be dangerous
    const dangerousFunctions = [
      'PG_READ_FILE',
      'PG_WRITE_FILE',
      'PG_SLEEP',
      'PG_TERMINATE_BACKEND',
      'PG_CANCEL_BACKEND',
      'PG_RELOAD_CONF',
      'PG_ROTATE_LOGFILE',
      'PG_STAT_FILE',
      'PG_LS_DIR',
      'PG_READ_BINARY_FILE',
      'PG_STAT_FILE',
      'CURRENT_USER',
      'SESSION_USER',
      'USER',
      'CURRENT_DATABASE',
      'CURRENT_SCHEMA',
      'CURRENT_SCHEMAS',
      'VERSION',
      'HAS_DATABASE_PRIVILEGE',
      'HAS_SCHEMA_PRIVILEGE',
      'HAS_TABLE_PRIVILEGE',
      'HAS_COLUMN_PRIVILEGE',
      'HAS_FUNCTION_PRIVILEGE',
      'HAS_LANGUAGE_PRIVILEGE',
      'HAS_SEQUENCE_PRIVILEGE',
      'HAS_TABLESPACE_PRIVILEGE',
      'HAS_TYPE_PRIVILEGE',
    ];

    for (const func of dangerousFunctions) {
      const regex = new RegExp(`\\b${func}\\b`, 'i');
      if (regex.test(sql)) {
        return { valid: false, error: `Prohibited function: ${func}` };
      }
    }

    // Block information_schema queries that could expose sensitive data
    if (upperSql.includes('INFORMATION_SCHEMA')) {
      return { valid: false, error: 'Information schema queries are not allowed' };
    }

    // Block pg_catalog queries
    if (upperSql.includes('PG_CATALOG')) {
      return { valid: false, error: 'System catalog queries are not allowed' };
    }

    // Block queries that could cause performance issues
    if (upperSql.includes('CROSS JOIN') && !upperSql.includes('WHERE')) {
      return { valid: false, error: 'CROSS JOIN without WHERE clause is not allowed' };
    }

    // Block queries with excessive LIMIT
    const limitMatch = sql.match(/\s+LIMIT\s+(\d+)/i);
    if (limitMatch && limitMatch[1]) {
      const limitValue = parseInt(limitMatch[1]);
      if (limitValue > 10000) {
        return { valid: false, error: 'LIMIT cannot exceed 10,000 rows' };
      }
    }

    return { valid: true };
  }

  static sanitizeSql(sql: string): string {
    // Remove comments
    let cleanSql = sql.replace(/--[^\n]*(\n|$)/g, '\n');
    cleanSql = cleanSql.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Trim whitespace
    cleanSql = cleanSql.trim();
    
    // Remove trailing semicolon
    cleanSql = cleanSql.replace(/;$/, '');
    
    return cleanSql;
  }
}

