import { describe, it, expect } from '@jest/globals';
import {
  detectAllGPSColumnPairs,
  detectGPSColumns,
  validateGPSData,
  extractGPSPoints,
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
});

describe('detectGPSColumns (first pair)', () => {
  it('returns the first detected pair for text coordinates', () => {
    expect(detectGPSColumns(violationColumns('text'))).toEqual({
      latColumn: 'latitude',
      lonColumn: 'longitude',
    });
  });

  it('returns null when nothing is detectable', () => {
    expect(detectGPSColumns([{ name: 'place', type: 'text' }])).toBeNull();
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
