/**
 * Utility to extract parameter names from SQL queries
 */

/**
 * Extract parameter names from a SQL query that uses :parameter_name syntax
 * @param sql The SQL query string
 * @returns Array of parameter names found in the SQL
 */
export function extractParameterNames(sql: string): string[] {
  // Match :parameter_name patterns, ensuring word boundaries
  const paramPattern = /:(\w+)/g;
  const matches = sql.match(paramPattern);
  
  if (!matches) {
    return [];
  }
  
  // Extract parameter names (remove the : prefix) and deduplicate
  const paramNames = matches.map(match => match.substring(1));
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
