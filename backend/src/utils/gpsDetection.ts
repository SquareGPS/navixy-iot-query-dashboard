/**
 * GPS Column Detection Utility
 * Auto-detects GPS coordinate columns from query result columns
 */

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface GPSColumns {
  latColumn: string;
  lonColumn: string;
}

// Common patterns for latitude column names (case-insensitive)
const GPS_LAT_PATTERNS = [
  'lat',
  'latitude',
  'y_coord',
  'y_coordinate',
  'lat_deg',
  'latitude_deg',
  'gps_lat',
  'gps_latitude',
  'geo_lat',
  'location_lat',
  'position_lat',
  'coords_lat',
  'y',
];

// Common patterns for longitude column names (case-insensitive)
const GPS_LON_PATTERNS = [
  'lon',
  'lng',
  'longitude',
  'x_coord',
  'x_coordinate',
  'lon_deg',
  'lng_deg',
  'longitude_deg',
  'gps_lon',
  'gps_lng',
  'gps_longitude',
  'geo_lon',
  'geo_lng',
  'location_lon',
  'location_lng',
  'position_lon',
  'position_lng',
  'coords_lon',
  'coords_lng',
  'x',
];

// Numeric PostgreSQL types that could contain GPS coordinates
const NUMERIC_TYPES = [
  'real',
  'double precision',
  'numeric',
  'decimal',
  'float4',
  'float8',
  'integer',
  'bigint',
  'smallint',
];

// Textual PostgreSQL types that may still carry coordinate values. Reports
// routinely format lat/lon for display — ROUND(lat, 6)::text, to_char(...),
// or string concatenation — and some drivers surface numeric/decimal columns
// as strings. Such a column is still a valid coordinate source, so it must not
// be excluded from detection purely on its declared type (see FR-11283).
// Matched by substring (see isTextType), so 'text' also covers 'citext' and
// 'char' also covers 'varchar', 'character', 'character varying', and 'bpchar'.
const TEXT_TYPES = ['text', 'char'];

/**
 * Check if a column type is numeric (could contain GPS coordinates)
 */
function isNumericType(type: string): boolean {
  const normalizedType = type.toLowerCase();
  return NUMERIC_TYPES.some(numType => normalizedType.includes(numType));
}

/**
 * Check if a column type is textual.
 */
function isTextType(type: string): boolean {
  const normalizedType = type.toLowerCase();
  return TEXT_TYPES.some(textType => normalizedType.includes(textType));
}

/**
 * A column may hold GPS coordinates if it is numeric OR textual. Detection is
 * driven by the column NAME (strict lat/lon patterns below) and confirmed by
 * validating the actual values are in range (validateGPSData), so admitting
 * textual columns here does not create false positives — it only stops
 * display-formatted coordinate columns from being silently dropped.
 */
function isCoordinateCandidateType(type: string): boolean {
  return isNumericType(type) || isTextType(type);
}

/**
 * Check if a column name matches any of the given patterns
 */
function matchesPatterns(columnName: string, patterns: string[]): boolean {
  const normalizedName = columnName.toLowerCase().trim();
  
  return patterns.some(pattern => {
    // Exact match
    if (normalizedName === pattern) return true;
    
    // Contains pattern with word boundaries (underscore, start/end)
    const regex = new RegExp(`(^|_)${pattern}(_|$)`, 'i');
    if (regex.test(normalizedName)) return true;
    
    // Starts or ends with pattern
    if (normalizedName.startsWith(pattern) || normalizedName.endsWith(pattern)) return true;
    
    return false;
  });
}

/**
 * Extract the "stem" of a column name by removing the matched GPS pattern.
 * Used to pair lat/lon columns that share the same prefix/suffix.
 * E.g. "start_lat" with pattern "lat" → stem "start",
 *      "end_longitude" with pattern "longitude" → stem "end"
 */
function getColumnStem(columnName: string, patterns: string[]): string {
  const name = columnName.toLowerCase().trim();
  const sorted = [...patterns].sort((a, b) => b.length - a.length);

  for (const pattern of sorted) {
    if (name === pattern) return '';

    const idx = name.indexOf(pattern);
    if (idx !== -1) {
      const before = name.substring(0, idx);
      const after = name.substring(idx + pattern.length);
      if ((before === '' || before.endsWith('_')) && (after === '' || after.startsWith('_'))) {
        return (before + after).replace(/^_+|_+$/g, '').replace(/_+/g, '_');
      }
    }
  }
  return name;
}

/**
 * Detect ALL GPS column pairs from query result columns.
 * Pairs lat/lon columns by matching their stems (the non-pattern part of the name).
 * E.g. start_lat + start_lon, end_lat + end_lon, lat + lon
 */
export function detectAllGPSColumnPairs(columns: ColumnInfo[]): GPSColumns[] {
  const candidateColumns = columns.filter(col => isCoordinateCandidateType(col.type));
  if (candidateColumns.length < 2) return [];

  const latCols = candidateColumns.filter(col => matchesPatterns(col.name, GPS_LAT_PATTERNS));
  const lonCols = candidateColumns.filter(col => matchesPatterns(col.name, GPS_LON_PATTERNS));
  if (latCols.length === 0 || lonCols.length === 0) return [];

  const pairs: GPSColumns[] = [];
  const usedLons = new Set<string>();

  for (const latCol of latCols) {
    const latStem = getColumnStem(latCol.name, GPS_LAT_PATTERNS);

    const matchingLon = lonCols.find(lonCol => {
      if (usedLons.has(lonCol.name)) return false;
      return getColumnStem(lonCol.name, GPS_LON_PATTERNS) === latStem;
    });

    if (matchingLon) {
      pairs.push({ latColumn: latCol.name, lonColumn: matchingLon.name });
      usedLons.add(matchingLon.name);
    }
  }

  return pairs;
}

/**
 * Detect GPS columns from query result columns (first pair only).
 * Kept for backward compatibility.
 */
export function detectGPSColumns(columns: ColumnInfo[]): GPSColumns | null {
  const pairs = detectAllGPSColumnPairs(columns);
  return pairs[0] ?? null;
}

/**
 * Validate that data rows contain valid GPS coordinates
 * 
 * @param rows - Data rows to validate
 * @param gpsColumns - Column names for lat/lon
 * @returns true if at least one row has valid GPS coordinates
 */
export function validateGPSData(
  rows: Record<string, unknown>[],
  gpsColumns: GPSColumns
): boolean {
  if (!rows || rows.length === 0) {
    return false;
  }

  // Check if at least one row has valid coordinates
  return rows.some(row => {
    const lat = parseFloat(String(row[gpsColumns.latColumn]));
    const lon = parseFloat(String(row[gpsColumns.lonColumn]));

    // Valid GPS range: lat -90 to 90, lon -180 to 180
    return (
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  });
}

/**
 * Build row objects keyed by column name from positional (array) result rows.
 * Value-based GPS validation/extraction needs this shape.
 */
export function toRowObjects(
  columns: ColumnInfo[],
  rows: unknown[][]
): Record<string, unknown>[] {
  return rows.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      obj[col.name] = row[idx];
    });
    return obj;
  });
}

/**
 * Detect the coordinate pair that should drive a map: the first name-matched
 * pair whose values actually validate as in-range coordinates.
 *
 * Prefer this over detectGPSColumns() wherever real rows are available. Picking
 * detectAllGPSColumnPairs()[0] blindly can select an empty or all-null pair
 * (e.g. start_lat/start_lon) ahead of a populated one and produce a blank map;
 * validating here keeps the live view and the HTML/PDF exports consistent (FR-11283).
 *
 * @returns the first valid pair, or null when nothing detectable carries valid data
 */
export function detectValidGPSColumns(
  columns: ColumnInfo[],
  rows: Record<string, unknown>[]
): GPSColumns | null {
  return detectAllGPSColumnPairs(columns).find(pair => validateGPSData(rows, pair)) ?? null;
}

/**
 * Extract GPS points from data rows
 * 
 * @param rows - Data rows to extract from
 * @param gpsColumns - Column names for lat/lon
 * @param labelColumn - Optional column name for marker labels
 * @returns Array of GPS points with lat, lon, and optional label
 */
export function extractGPSPoints(
  rows: Record<string, unknown>[],
  gpsColumns: GPSColumns,
  labelColumn?: string
): Array<{ lat: number; lon: number; label?: string | undefined; data: Record<string, unknown> }> {
  const points: Array<{ lat: number; lon: number; label?: string | undefined; data: Record<string, unknown> }> = [];

  for (const row of rows) {
    const lat = parseFloat(String(row[gpsColumns.latColumn]));
    const lon = parseFloat(String(row[gpsColumns.lonColumn]));

    // Skip invalid coordinates
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      continue;
    }

    const point: { lat: number; lon: number; label?: string | undefined; data: Record<string, unknown> } = {
      lat,
      lon,
      data: row,
    };
    
    if (labelColumn) {
      point.label = String(row[labelColumn] || '');
    }

    points.push(point);
  }

  return points;
}

/**
 * Get suggested label column from available columns
 * Prefers common label patterns like 'name', 'title', 'label', 'id'
 */
export function suggestLabelColumn(columns: ColumnInfo[]): string | null {
  const labelPatterns = ['name', 'title', 'label', 'description', 'id', 'identifier'];
  
  for (const pattern of labelPatterns) {
    const match = columns.find(col => 
      col.name.toLowerCase().includes(pattern)
    );
    if (match) {
      return match.name;
    }
  }

  // Fallback to first non-numeric column
  const textColumn = columns.find(col => !isNumericType(col.type));
  return textColumn?.name || null;
}
