/**
 * Utility to extract parameter names from SQL queries
 * Ignores parameters inside quoted strings (single or double quotes)
 * Uses ${variable_name} syntax (Grafana-style template variables)
 */

/**
 * Extract parameter names from a SQL query that uses ${variable_name} syntax
 * Ignores parameters inside quoted strings (single or double quotes)
 * @param sql The SQL query string
 * @returns Array of parameter names found in the SQL
 */
export function extractParameterNames(sql: string): string[] {
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
        paramNames.push(paramName);
        i = j + 1; // Skip the closing '}'
        continue;
      }
    }

    i++;
  }

  // Deduplicate
  return [...new Set(paramNames)];
}

/**
 * Filter parameters to only include those that are actually used in the SQL
 * @param sql The SQL query string
 * @param allParams All available parameters
 * @returns Filtered parameters object containing only used parameters
 */
export function filterUsedParameters(sql: string, allParams: Record<string, unknown>): Record<string, unknown> {
  const usedParamNames = extractParameterNames(sql);
  const filteredParams: Record<string, unknown> = {};
  
  usedParamNames.forEach(paramName => {
    if (allParams.hasOwnProperty(paramName)) {
      filteredParams[paramName] = allParams[paramName];
    }
  });
  
  return filteredParams;
}
