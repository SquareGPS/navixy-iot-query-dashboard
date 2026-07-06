import { describe, it, expect } from '@jest/globals';
import {
  detectAllGPSColumnPairs,
  detectValidGPSColumns,
  selectValidGPSPair,
  toRowObjects,
  validateGPSData,
  extractGPSPoints,
  parseCoordinate,
  type ColumnInfo,
} from '../gpsDetection.js';

// A "Violation Detail (Driver performance)" style column set, parameterised on
// the declared type of the coordinate columns. Mirrors the real report shape.
const violationColumns = (coordType: string): ColumnInfo[] => [
  { name: 'violation_time', type: 'text' },
  { name: 'vehicle', type: 'varchar' },
  { name: 'violation_type', type: 'text' },
  { name: 'speed', type: 'text' },
  { name: 'latitude', type: coordType },
  { name: 'longitude', type: coordType },
];

describe('detectAllGPSColumnPairs', () => {
  it('detects a clean numeric latitude/longitude pair', () => {
    expect(detectAllGPSColumnPairs(violationColumns('numeric'))).toEqual([
      { latColumn: 'latitude', lonColumn: 'longitude' },
    ]);
  });

  it('detects double precision coordinate columns', () => {
    expect(detectAllGPSColumnPairs(violationColumns('double precision'))).toEqual([
      { latColumn: 'latitude', lonColumn: 'longitude' },
    ]);
  });

  // FR-11283: reports often format coordinates for display with
  // ROUND(lat, 6)::text / to_char(...), giving text-typed lat/lon columns.
  // Those columns must still be detected so the Location Map can render.
  it('detects coordinate columns declared as text (FR-11283)', () => {
    expect(detectAllGPSColumnPairs(violationColumns('text'))).toEqual([
      { latColumn: 'latitude', lonColumn: 'longitude' },
    ]);
  });

  it('detects coordinate columns declared as varchar/character varying', () => {
    expect(detectAllGPSColumnPairs(violationColumns('character varying'))).toEqual([
      { latColumn: 'latitude', lonColumn: 'longitude' },
    ]);
  });

  it('detects short lat/lng names', () => {
    expect(
      detectAllGPSColumnPairs([
        { name: 'event', type: 'text' },
        { name: 'lat', type: 'text' },
        { name: 'lng', type: 'text' },
      ]),
    ).toEqual([{ latColumn: 'lat', lonColumn: 'lng' }]);
  });

  it('pairs multiple coordinate sets by stem (start_/end_)', () => {
    const pairs = detectAllGPSColumnPairs([
      { name: 'start_lat', type: 'text' },
      { name: 'start_lon', type: 'text' },
      { name: 'end_lat', type: 'double precision' },
      { name: 'end_lon', type: 'double precision' },
    ]);
    expect(pairs).toEqual([
      { latColumn: 'start_lat', lonColumn: 'start_lon' },
      { latColumn: 'end_lat', lonColumn: 'end_lon' },
    ]);
  });

  it('returns [] when no column name matches a coordinate pattern', () => {
    // The value may look like a coordinate ("55.75, 37.62") but lives in a
    // single non-coordinate-named column — nothing to pair.
    expect(
      detectAllGPSColumnPairs([
        { name: 'violation_time', type: 'text' },
        { name: 'place', type: 'text' },
        { name: 'speed_kmh', type: 'numeric' },
      ]),
    ).toEqual([]);
  });

  it('does not pair unrelated text columns just because types are now admitted', () => {
    // Broadening candidate types to text must not turn ordinary text columns
    // into coordinates — the name patterns remain the gate.
    expect(
      detectAllGPSColumnPairs([
        { name: 'driver_name', type: 'text' },
        { name: 'vehicle', type: 'varchar' },
        { name: 'address', type: 'text' },
      ]),
    ).toEqual([]);
  });

  it('ignores date/time/boolean/json columns even if their name matches loosely', () => {
    // "day" ends with the single-char lat pattern "y"; it must not be treated as
    // a coordinate because its type is not a coordinate-carrying type.
    expect(
      detectAllGPSColumnPairs([
        { name: 'day', type: 'date' },
        { name: 'active_flag', type: 'boolean' },
        { name: 'payload', type: 'jsonb' },
      ]),
    ).toEqual([]);
  });

  // Now that text columns are admitted, the single-char 'x'/'y' patterns must
  // not loosely match ordinary words via startsWith/endsWith.
  it('does not pair plain text columns that merely end in x/y', () => {
    expect(
      detectAllGPSColumnPairs([
        { name: 'summary', type: 'text' }, // ends in 'y'
        { name: 'max', type: 'numeric' }, // ends in 'x'
      ]),
    ).toEqual([]);
  });

  it('does not pair aligned-stem text columns like boundary + boundary_x', () => {
    expect(
      detectAllGPSColumnPairs([
        { name: 'boundary', type: 'text' }, // ends in 'y'
        { name: 'boundary_x', type: 'text' },
      ]),
    ).toEqual([]);
  });

  it('still pairs columns named exactly x/y and _x/_y suffixed', () => {
    expect(detectAllGPSColumnPairs([
      { name: 'y', type: 'double precision' },
      { name: 'x', type: 'double precision' },
    ])).toEqual([{ latColumn: 'y', lonColumn: 'x' }]);
    expect(detectAllGPSColumnPairs([
      { name: 'start_y', type: 'double precision' },
      { name: 'start_x', type: 'double precision' },
    ])).toEqual([{ latColumn: 'start_y', lonColumn: 'start_x' }]);
  });
});

describe('parseCoordinate', () => {
  it('passes through numbers and plain decimal strings', () => {
    expect(parseCoordinate(47.53)).toBe(47.53);
    expect(parseCoordinate('-18.368642')).toBe(-18.368642);
    expect(parseCoordinate('  26.476326  ')).toBe(26.476326);
    expect(parseCoordinate('0')).toBe(0);
  });

  // Reject display-formatted strings rather than misparse them (parseFloat would
  // return 18.36 / 55, silently plotting the wrong point).
  it('rejects hemisphere-suffixed and locale-formatted strings', () => {
    expect(parseCoordinate('18.36° S')).toBeNaN();
    expect(parseCoordinate('55,75')).toBeNaN();
    expect(parseCoordinate('1.5E10')).toBeNaN();
    expect(parseCoordinate('n/a')).toBeNaN();
    expect(parseCoordinate(null)).toBeNaN();
    expect(parseCoordinate(undefined)).toBeNaN();
  });
});

describe('validateGPSData', () => {
  const gps = { latColumn: 'latitude', lonColumn: 'longitude' };

  it('accepts in-range coordinates provided as strings (text columns)', () => {
    expect(
      validateGPSData([{ latitude: '-18.368642', longitude: '26.476326' }], gps),
    ).toBe(true);
  });

  it('accepts in-range coordinates provided as numbers', () => {
    expect(validateGPSData([{ latitude: 47.53, longitude: 34.9 }], gps)).toBe(true);
  });

  it('rejects out-of-range values (e.g. scaled-integer coordinates)', () => {
    expect(
      validateGPSData([{ latitude: 557500000, longitude: 376200000 }], gps),
    ).toBe(false);
  });

  // Display-formatted coordinates must not validate — otherwise the map would
  // render markers in the wrong hemisphere / off by the locale decimal.
  it('rejects hemisphere/locale-formatted coordinate strings', () => {
    expect(validateGPSData([{ latitude: '18.36° S', longitude: '26.47° E' }], gps)).toBe(false);
    expect(validateGPSData([{ latitude: '55,75', longitude: '37,62' }], gps)).toBe(false);
  });

  it('rejects empty data', () => {
    expect(validateGPSData([], gps)).toBe(false);
  });
});

describe('extractGPSPoints', () => {
  it('parses text coordinate values into numeric points and skips invalid rows', () => {
    const rows = [
      { latitude: '-18.368642', longitude: '26.476326', vehicle: 'Truck 2' },
      { latitude: 'n/a', longitude: 'n/a', vehicle: 'Truck 9' }, // dropped
    ];
    const points = extractGPSPoints(rows, { latColumn: 'latitude', lonColumn: 'longitude' }, 'vehicle');
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ lat: -18.368642, lon: 26.476326, label: 'Truck 2' });
  });
});

describe('toRowObjects', () => {
  it('maps positional rows to objects keyed by column name', () => {
    const columns: ColumnInfo[] = [
      { name: 'vehicle', type: 'text' },
      { name: 'latitude', type: 'numeric' },
    ];
    expect(toRowObjects(columns, [['Truck 2', '-18.37'], ['Truck 9', '47.53']])).toEqual([
      { vehicle: 'Truck 2', latitude: '-18.37' },
      { vehicle: 'Truck 9', latitude: '47.53' },
    ]);
  });

  // Duplicate column names (e.g. a self-join selecting two `lat`s) collapse to
  // one key; keep the first populated value so a trailing NULL can't blank it.
  it('keeps the first populated value on duplicate column names', () => {
    const columns: ColumnInfo[] = [
      { name: 'lat', type: 'double precision' },
      { name: 'lat', type: 'double precision' },
    ];
    expect(toRowObjects(columns, [[47.53, null]])).toEqual([{ lat: 47.53 }]);
    expect(toRowObjects(columns, [[null, 47.53]])).toEqual([{ lat: 47.53 }]);
  });
});

describe('selectValidGPSPair', () => {
  it('returns the first pair with valid data from already-detected pairs', () => {
    const pairs = [
      { latColumn: 'start_lat', lonColumn: 'start_lon' },
      { latColumn: 'lat', lonColumn: 'lon' },
    ];
    const rows = [{ start_lat: null, start_lon: null, lat: 47.53, lon: 34.9 }];
    expect(selectValidGPSPair(pairs, rows)).toEqual({ latColumn: 'lat', lonColumn: 'lon' });
    expect(selectValidGPSPair([], rows)).toBeNull();
  });
});

describe('detectValidGPSColumns', () => {
  it('selects a text-typed pair whose values are valid coordinates (FR-11283)', () => {
    const columns = violationColumns('text');
    const rows = toRowObjects(columns, [
      ['06/07 10:24', 'Truck 2', 'Idling', '-', '-18.368642', '26.476326'],
    ]);
    expect(detectValidGPSColumns(columns, rows)).toEqual({
      latColumn: 'latitude',
      lonColumn: 'longitude',
    });
  });

  // The reason /execute and the exports must select by value, not by pairs[0]:
  // a query can expose an all-null start_lat/start_lon ahead of a populated
  // lat/lon, and the map must fall through to the populated one.
  it('skips an all-null leading pair and selects the populated pair', () => {
    const columns: ColumnInfo[] = [
      { name: 'start_lat', type: 'double precision' },
      { name: 'start_lon', type: 'double precision' },
      { name: 'lat', type: 'double precision' },
      { name: 'lon', type: 'double precision' },
    ];
    // start_* is detected first (column order), so pairs[0] alone would be wrong
    expect(detectAllGPSColumnPairs(columns)).toEqual([
      { latColumn: 'start_lat', lonColumn: 'start_lon' },
      { latColumn: 'lat', lonColumn: 'lon' },
    ]);
    const rows = toRowObjects(columns, [[null, null, 47.5377984, 34.9014016]]);
    expect(detectValidGPSColumns(columns, rows)).toEqual({ latColumn: 'lat', lonColumn: 'lon' });
  });

  it('returns null when the only detected pair has no in-range data', () => {
    const columns = violationColumns('numeric');
    // scaled-integer coordinates — out of the -90..90 / -180..180 range
    const rows = toRowObjects(columns, [
      ['06/07 10:24', 'Truck 2', 'Idling', '-', 557500000, 376200000],
    ]);
    expect(detectValidGPSColumns(columns, rows)).toBeNull();
  });

  it('returns null when no column name matches a coordinate pattern', () => {
    const columns: ColumnInfo[] = [
      { name: 'place', type: 'text' },
      { name: 'speed', type: 'numeric' },
    ];
    expect(detectValidGPSColumns(columns, toRowObjects(columns, [['somewhere', 42]]))).toBeNull();
  });
});
