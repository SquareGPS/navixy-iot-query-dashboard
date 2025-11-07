/**
 * Grafana Time Expression Parser
 * Parses Grafana-style relative time expressions (e.g., now-7d/d, now-24h)
 * and converts them to absolute Date objects
 */

/**
 * Parse a Grafana time expression to an absolute Date
 * Supports:
 * - now (current time)
 * - now-Nh (N hours ago)
 * - now-Nd (N days ago)
 * - now-Nw (N weeks ago)
 * - now-NM (N months ago)
 * - now-Ny (N years ago)
 * - now-Nh/d (N hours ago, rounded to start of day)
 * - now-Nd/d (N days ago, rounded to start of day)
 * - now-Nw/w (N weeks ago, rounded to start of week)
 * - now-NM/M (N months ago, rounded to start of month)
 * - ISO-8601 absolute timestamps (e.g., 2025-11-06T00:00:00Z)
 * 
 * @param expression Grafana time expression or ISO-8601 timestamp
 * @param timezone Timezone offset in minutes (default: browser timezone)
 * @returns Absolute Date object
 */
export function parseGrafanaTime(
  expression: string,
  timezone?: number
): Date {
  // Handle absolute ISO-8601 timestamps
  if (/^\d{4}-\d{2}-\d{2}/.test(expression)) {
    const date = new Date(expression);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Handle "now"
  if (expression === 'now') {
    return new Date();
  }

  // Parse relative expressions: now-Nh, now-Nd, etc.
  const match = expression.match(/^now(-(\d+)([hdwMy]))?(\/([dwMy]))?$/);
  if (!match) {
    // If it doesn't match, try to parse as ISO date or return current time
    const date = new Date(expression);
    return isNaN(date.getTime()) ? new Date() : date;
  }

  const now = new Date();
  const offset = match[2] ? parseInt(match[2], 10) : 0;
  const unit = match[3] || '';
  const roundUnit = match[5] || '';

  // Calculate base time
  let baseTime = new Date(now);

  if (offset > 0) {
    switch (unit) {
      case 'h':
        baseTime = new Date(now.getTime() - offset * 60 * 60 * 1000);
        break;
      case 'd':
        baseTime = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
        break;
      case 'w':
        baseTime = new Date(now.getTime() - offset * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'M':
        baseTime = new Date(now);
        baseTime.setMonth(now.getMonth() - offset);
        break;
      case 'y':
        baseTime = new Date(now);
        baseTime.setFullYear(now.getFullYear() - offset);
        break;
    }
  }

  // Apply rounding if specified
  if (roundUnit) {
    switch (roundUnit) {
      case 'd':
        // Round to start of day in local timezone
        baseTime.setHours(0, 0, 0, 0);
        break;
      case 'w':
        // Round to start of week (Sunday)
        const dayOfWeek = baseTime.getDay();
        baseTime.setDate(baseTime.getDate() - dayOfWeek);
        baseTime.setHours(0, 0, 0, 0);
        break;
      case 'M':
        // Round to start of month
        baseTime.setDate(1);
        baseTime.setHours(0, 0, 0, 0);
        break;
      case 'y':
        // Round to start of year
        baseTime.setMonth(0, 1);
        baseTime.setHours(0, 0, 0, 0);
        break;
    }
  }

  return baseTime;
}

/**
 * Parse a Grafana time range expression
 * @param fromExpression From time expression
 * @param toExpression To time expression
 * @returns Object with from and to Date objects
 */
export function parseGrafanaTimeRange(
  fromExpression: string,
  toExpression: string
): { from: Date; to: Date } {
  return {
    from: parseGrafanaTime(fromExpression),
    to: parseGrafanaTime(toExpression)
  };
}

/**
 * Format a Date to ISO-8601 string (UTC)
 * @param date Date object
 * @returns ISO-8601 string
 */
export function formatDateToISO(date: Date): string {
  return date.toISOString();
}

/**
 * Format a Date to local datetime string for input fields
 * @param date Date object
 * @returns Local datetime string (YYYY-MM-DDTHH:mm)
 */
export function formatDateToLocalInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

