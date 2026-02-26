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

/**
 * Check if a column type is numeric (could contain GPS coordinates)
 */
function isNumericType(type: string): boolean {
  const normalizedType = type.toLowerCase();
  return NUMERIC_TYPES.some(numType => normalizedType.includes(numType));
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
  const numericColumns = columns.filter(col => isNumericType(col.type));
  if (numericColumns.length < 2) return [];

  const latCols = numericColumns.filter(col => matchesPatterns(col.name, GPS_LAT_PATTERNS));
  const lonCols = numericColumns.filter(col => matchesPatterns(col.name, GPS_LON_PATTERNS));
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
  rows: Record<string, any>[],
  gpsColumns: GPSColumns
): boolean {
  if (!rows || rows.length === 0) {
    return false;
  }

  // Check if at least one row has valid coordinates
  return rows.some(row => {
    const lat = parseFloat(row[gpsColumns.latColumn]);
    const lon = parseFloat(row[gpsColumns.lonColumn]);
    
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
 * Extract GPS points from data rows
 * 
 * @param rows - Data rows to extract from
 * @param gpsColumns - Column names for lat/lon
 * @param labelColumn - Optional column name for marker labels
 * @returns Array of GPS points with lat, lon, and optional label
 */
export function extractGPSPoints(
  rows: Record<string, any>[],
  gpsColumns: GPSColumns,
  labelColumn?: string
): Array<{ lat: number; lon: number; label?: string | undefined; data: Record<string, any> }> {
  const points: Array<{ lat: number; lon: number; label?: string | undefined; data: Record<string, any> }> = [];

  for (const row of rows) {
    const lat = parseFloat(row[gpsColumns.latColumn]);
    const lon = parseFloat(row[gpsColumns.lonColumn]);

    // Skip invalid coordinates
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      continue;
    }

    const point: { lat: number; lon: number; label?: string | undefined; data: Record<string, any> } = {
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
