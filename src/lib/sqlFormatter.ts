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
 * Minifies SQL by removing extra whitespace and line breaks
 */
export function minifySql(sql: string): string {
  if (!sql || typeof sql !== 'string') {
    return '';
  }

  return sql
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\s*,\s*/g, ', ') // Normalize comma spacing
    .replace(/\s*\(\s*/g, '(') // Remove spaces around opening parens
    .replace(/\s*\)\s*/g, ')') // Remove spaces around closing parens
    .trim();
}
