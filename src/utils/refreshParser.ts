/**
 * Refresh Interval Parser
 * Parses refresh interval strings (e.g., "1m", "30s", "5m", "1h") to milliseconds
 * Supports Grafana-style refresh intervals
 */

/**
 * Parse a refresh interval string to milliseconds
 * Supports:
 * - "10s" - 10 seconds
 * - "30s" - 30 seconds
 * - "1m" - 1 minute
 * - "5m" - 5 minutes
 * - "15m" - 15 minutes
 * - "30m" - 30 minutes
 * - "1h" - 1 hour
 * - "2h" - 2 hours
 * - "1d" - 1 day
 * 
 * @param interval Refresh interval string (e.g., "1m", "30s")
 * @returns Interval in milliseconds, or null if invalid
 */
export function parseRefreshInterval(interval: string | undefined | null): number | null {
  if (!interval || typeof interval !== 'string') {
    return null;
  }

  // Remove whitespace and convert to lowercase
  const normalized = interval.trim().toLowerCase();

  // Handle "off" or empty string to disable refresh
  if (normalized === 'off' || normalized === '') {
    return null;
  }

  // Match pattern: number followed by unit (s, m, h, d)
  const match = normalized.match(/^(\d+)([smhd])$/);
  if (!match) {
    return null;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (isNaN(value) || value <= 0) {
    return null;
  }

  // Convert to milliseconds
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

