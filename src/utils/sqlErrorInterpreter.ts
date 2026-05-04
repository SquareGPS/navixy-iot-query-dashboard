/**
 * Accepted error shapes: plain string, structured object with optional
 * PostgreSQL `sqlCode` in `details`, or the ApiResponse `error` envelope.
 */
export type SqlErrorLike = {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};

function normalizeMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

/**
 * Convert low-level SQL/driver errors into user-friendly messages.
 */
export function interpretSqlError(error: SqlErrorLike | string | undefined | null): string {
  if (!error) {
    return 'Query failed. Please check SQL syntax and parameter values.';
  }

  const rawMessage = typeof error === 'string' ? error : (error.message || '');
  const message = normalizeMessage(rawMessage);
  const code = typeof error === 'string' ? undefined : error.code;
  const sqlCode = typeof error === 'string' ? undefined : (error.details?.sqlCode as string | undefined);
  const lowered = message.toLowerCase();

  if (sqlCode === '22P02' || lowered.includes('invalid input syntax')) {
    return `Invalid value type for SQL parameter. ${message || 'Check date/number parameters and their formats.'}`;
  }

  if (sqlCode === '42601' || lowered.includes('syntax error')) {
    return `SQL syntax error. ${message || 'Please verify query syntax near the reported position.'}`;
  }

  if (sqlCode === '42703' || (lowered.includes('column') && lowered.includes('does not exist'))) {
    return `Unknown column in query. ${message || 'Verify selected table aliases and column names.'}`;
  }

  if (sqlCode === '42P01' || (lowered.includes('relation') && lowered.includes('does not exist'))) {
    return `Table or view not found. ${message || 'Check schema and table names in the query.'}`;
  }

  if (sqlCode === '42883' || (lowered.includes('function') && lowered.includes('does not exist'))) {
    return `SQL function mismatch. ${message || 'Check function name and argument types.'}`;
  }

  if (sqlCode === '42501' || lowered.includes('permission denied')) {
    return `Insufficient privileges. ${message || 'The database user lacks access to this table or function.'}`;
  }

  if (sqlCode === '23505' || lowered.includes('unique constraint') || lowered.includes('duplicate key')) {
    return `Duplicate key violation. ${message || 'A row with this key already exists.'}`;
  }

  if (sqlCode === '23503' || lowered.includes('foreign key constraint')) {
    return `Foreign key violation. ${message || 'Referenced record does not exist or cannot be removed.'}`;
  }

  if (code === 'NETWORK_ERROR' || lowered.includes('network')) {
    return `Network issue while executing query. ${message || 'Please retry in a few seconds.'}`;
  }

  if (sqlCode === '57014' || lowered.includes('timeout') || lowered.includes('canceling statement due to statement timeout')) {
    return `Query timeout exceeded. ${message || 'Try narrowing date range or simplifying SQL.'}`;
  }

  if (!message) {
    return 'Query failed. Please check SQL syntax and parameter values.';
  }

  return message;
}
