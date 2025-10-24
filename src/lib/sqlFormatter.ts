/**
 * Simple SQL formatter utility
 * Formats SQL queries with proper indentation and line breaks
 */

export function formatSql(sql: string): string {
  if (!sql || typeof sql !== 'string') {
    return '';
  }

  // Remove extra whitespace and normalize
  let formatted = sql.trim().replace(/\s+/g, ' ');

  // Add line breaks after major SQL keywords
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 
    'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT', 'JOIN', 'LEFT JOIN', 
    'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON', 'AND', 'OR'
  ];

  // Format each keyword
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, `\n${keyword}`);
  });

  // Clean up multiple newlines and add proper indentation
  formatted = formatted
    .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
    .split('\n')
    .map((line, index) => {
      if (index === 0) return line.trim(); // First line no indent
      
      const trimmed = line.trim();
      if (!trimmed) return '';
      
      // Determine indentation level
      const upperKeywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'UNION', 'UNION ALL'];
      const indentKeywords = ['AND', 'OR', 'ON'];
      
      if (upperKeywords.some(kw => trimmed.toUpperCase().startsWith(kw))) {
        return trimmed; // No extra indent for major clauses
      } else if (indentKeywords.some(kw => trimmed.toUpperCase().startsWith(kw))) {
        return `  ${trimmed}`; // 2 spaces for AND/OR/ON
      } else {
        return `    ${trimmed}`; // 4 spaces for other lines
      }
    })
    .filter(line => line.trim() !== '') // Remove empty lines
    .join('\n');

  // Clean up the final result
  return formatted.trim();
}

/**
 * Preserves SQL formatting and comments
 * This function is kept for backward compatibility but now just returns the original SQL
 */
export function minifySql(sql: string): string {
  if (!sql || typeof sql !== 'string') {
    return '';
  }
  
  // Return original SQL with comments preserved
  return sql;
}
