/**
 * Parameter Binder
 * Converts SQL queries with named parameters (${param_name}) to prepared statement format
 * per database dialect (PostgreSQL $1, MySQL ?, ClickHouse ?, etc.)
 */

export type DatabaseDialect = 'postgresql' | 'mysql' | 'mssql' | 'clickhouse' | 'sqlite' | 'snowflake';

export interface BoundQuery {
  sql: string;
  values: unknown[];
  paramOrder: string[];
}

/**
 * Bind named parameters to prepared statement placeholders
 * @param sql SQL query with ${param_name} placeholders
 * @param params Object with parameter values
 * @param dialect Database dialect
 * @returns Bound query with SQL and values array
 */
export function bindParameters(
  sql: string,
  params: Record<string, unknown>,
  dialect: DatabaseDialect = 'postgresql'
): BoundQuery {
  const paramOrder: string[] = [];
  const values: unknown[] = [];
  let boundSql = sql;
  let paramIndex = 1;

  // Extract all parameter names from SQL (ignoring quoted strings)
  const paramNames = extractParameterNamesFromSQL(sql);

  // Process each parameter in the order it appears in SQL
  for (const paramName of paramNames) {
    // Skip if we've already processed this parameter
    if (paramOrder.includes(paramName)) {
      continue;
    }

    // Get parameter value
    const value = params[paramName];
    
    // Skip if parameter is not provided (will be handled by validation)
    if (value === undefined) {
      continue;
    }

    // Determine placeholder based on dialect
    let placeholder: string;
    switch (dialect) {
      case 'postgresql':
        placeholder = `$${paramIndex}`;
        break;
      case 'mysql':
      case 'clickhouse':
      case 'sqlite':
        placeholder = '?';
        break;
      case 'mssql':
        placeholder = `@p${paramIndex}`;
        break;
      case 'snowflake':
        placeholder = '?';
        break;
      default:
        placeholder = `$${paramIndex}`;
    }

    // Replace all occurrences of ${paramName} with placeholder
    // Escape special regex characters in paramName
    const escapedParamName = paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const paramPattern = new RegExp(`\\$\\{${escapedParamName}\\}`, 'g');
    boundSql = boundSql.replace(paramPattern, placeholder);

    // Add to values array
    values.push(value);
    paramOrder.push(paramName);
    paramIndex++;
  }

  return {
    sql: boundSql,
    values,
    paramOrder
  };
}

/**
 * Extract parameter names from SQL, preserving order and ignoring quoted strings
 * Uses ${variable_name} syntax
 */
function extractParameterNamesFromSQL(sql: string): string[] {
  const paramNames: string[] = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = i + 1 < sql.length ? sql[i + 1] : '';

    // Handle escaped quotes
    if (char === '\\' && nextChar) {
      i += 2;
      continue;
    }

    // Toggle quote states
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      i++;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      i++;
      continue;
    }

    // Only look for parameters outside of quoted strings
    // Match ${variable_name} syntax
    if (!inSingleQuote && !inDoubleQuote && char === '$' && nextChar === '{') {
      // Find the closing brace
      let j = i + 2; // Skip '${'
      let paramName = '';
      
      // Extract parameter name until closing brace
      while (j < sql.length && sql[j] !== '}') {
        // First character must be letter or underscore
        if (paramName.length === 0 && !/[A-Za-z_]/.test(sql[j])) {
          break; // Invalid parameter name start
        }
        // Subsequent characters can be letters, digits, or underscores
        if (paramName.length > 0 && !/[A-Za-z0-9_]/.test(sql[j])) {
          break; // Invalid character in parameter name
        }
        paramName += sql[j];
        j++;
      }
      
      // If we found a closing brace and have a valid parameter name
      if (j < sql.length && sql[j] === '}' && paramName.length > 0) {
        if (!paramNames.includes(paramName)) {
          paramNames.push(paramName);
        }
        i = j + 1; // Skip the closing '}'
        continue;
      }
    }

    i++;
  }

  return paramNames;
}

/**
 * Convert Date objects to ISO-8601 strings for database binding
 * @param value Value to convert
 * @returns Converted value
 */
export function prepareValueForBinding(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * Prepare all parameter values for binding
 * @param params Parameter values
 * @returns Prepared parameters
 */
export function prepareParametersForBinding(
  params: Record<string, unknown>
): Record<string, unknown> {
  const prepared: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    prepared[key] = prepareValueForBinding(value);
  }
  return prepared;
}

