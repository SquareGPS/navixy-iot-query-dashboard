import { describe, it, expect } from '@jest/globals';
import { applyGeocodedAddresses, addressLabel, type ColumnMeta } from '../geocodeColumns.js';

const columns: ColumnMeta[] = [
  { name: 'violation_time', type: 'text' },
  { name: 'start_lat', type: 'double precision' },
  { name: 'start_lon', type: 'double precision' },
  { name: 'lat', type: 'double precision' },
  { name: 'lon', type: 'double precision' },
];

describe('addressLabel', () => {
  it('derives a prefixed label from the lat column name', () => {
    expect(addressLabel('start_lat')).toBe('Start Address');
    expect(addressLabel('lat')).toBe('Address');
    expect(addressLabel('latitude')).toBe('Address');
  });
});

describe('applyGeocodedAddresses', () => {
  it('returns input unchanged when there are no geocoded addresses', () => {
    const rows = [['t', 1, 2, 3, 4]];
    expect(applyGeocodedAddresses(columns, rows, undefined, undefined, undefined)).toEqual({ columns, rows });
    expect(applyGeocodedAddresses(columns, rows, {}, 'lat', 'lon')).toEqual({ columns, rows });
  });

  // FR-11283 review #2: an all-NULL start_lat/start_lon pair surfaced by name
  // must not corrupt the export with a literal "NaN, NaN" address.
  it('leaves a non-numeric coordinate pair blank instead of emitting "NaN, NaN"', () => {
    const rows: unknown[][] = [['2026-07-06', null, null, 47.5377984, 34.9014016]];
    const geocoded = { '47.537798,34.901402': 'Kyiv, Ukraine' };
    const result = applyGeocodedAddresses(
      columns,
      rows,
      geocoded,
      'start_lat',
      'start_lon',
      [
        { latColumn: 'start_lat', lonColumn: 'start_lon' },
        { latColumn: 'lat', lonColumn: 'lon' },
      ],
    );

    expect(result.columns.map(c => c.name)).toEqual(['violation_time', 'Start Address', 'Address']);
    // start pair → blank (was "NaN, NaN"); populated pair → geocoded address
    expect(result.rows[0]).toEqual(['2026-07-06', '', 'Kyiv, Ukraine']);
    expect(JSON.stringify(result.rows)).not.toContain('NaN');
  });

  it('falls back to raw "lat, lng" when a populated pair has no geocode match', () => {
    const rows: unknown[][] = [['2026-07-06', null, null, 47.5377984, 34.9014016]];
    const result = applyGeocodedAddresses(
      columns,
      rows,
      { '0,0': 'unrelated' },
      'lat',
      'lon',
      [{ latColumn: 'lat', lonColumn: 'lon' }],
    );
    // Only the lat/lon pair is processed here; its column becomes "Address".
    const addrIdx = result.columns.findIndex(c => c.name === 'Address');
    expect(result.rows[0][addrIdx]).toBe('47.5377984, 34.9014016');
    expect(JSON.stringify(result.rows)).not.toContain('NaN');
  });
});
