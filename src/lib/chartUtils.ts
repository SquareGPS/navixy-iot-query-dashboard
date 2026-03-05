import type { NavixyColumnType } from '@/types/dashboard-types';

const DATE_COLUMN_TYPES: NavixyColumnType[] = ['timestamp', 'timestamptz', 'date'];

/**
 * Strict ISO-like date pattern: YYYY-MM-DD with optional time part.
 * Rejects bare numbers ("1", "42"), short strings, and human labels like "Truck 1".
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/;

export function isDateColumnType(type: NavixyColumnType | undefined): boolean {
  return !!type && DATE_COLUMN_TYPES.includes(type);
}

export function isLikelyDateString(value: unknown): boolean {
  const str = String(value).trim();
  if (!ISO_DATE_RE.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

export function formatDateLabel(value: unknown): string {
  const str = String(value);
  const date = new Date(str);
  if (isNaN(date.getTime())) return str;

  const hasTime = str.includes('T') || str.includes(':');
  if (hasTime) {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Build a tick-formatter for the X axis.
 * When the category column type is known, it is used; otherwise falls back to
 * a strict regex test so that values like "Truck 1" are never mis-parsed as dates.
 */
export function makeCategoryTickFormatter(
  columnType?: NavixyColumnType,
): (value: unknown) => string {
  const shouldFormatAsDates = columnType
    ? isDateColumnType(columnType)
    : undefined; // unknown – decide per value

  return (value: unknown) => {
    if (shouldFormatAsDates === true) {
      return formatDateLabel(value);
    }
    if (shouldFormatAsDates === false) {
      return String(value);
    }
    // Column type not available – strict per-value check
    if (isLikelyDateString(value)) {
      return formatDateLabel(value);
    }
    return String(value);
  };
}
