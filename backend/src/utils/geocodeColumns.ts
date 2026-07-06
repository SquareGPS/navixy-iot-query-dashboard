/**
 * Apply geocoded addresses to tabular query results for export.
 *
 * Each detected lat/lon pair is collapsed into a single human-readable Address
 * column: the lat column is renamed (e.g. `start_lat` -> "Start Address") and
 * filled with the geocoded address for that coordinate (falling back to the raw
 * "lat, lng" pair), and the lon column is dropped.
 */

export interface ColumnMeta {
  name: string;
  type: string;
}

export interface GeocodePair {
  latColumn: string;
  lonColumn: string;
}

/** Derive a human-readable address column name from the lat column name. */
export function addressLabel(latName: string): string {
  const prefix = latName.replace(/[_]?(lat|latitude|y_coord|y_coordinate|y)$/i, '').replace(/_+$/, '');
  if (!prefix) return 'Address';
  return prefix.charAt(0).toUpperCase() + prefix.slice(1) + ' Address';
}

export function applyGeocodedAddresses(
  columns: ColumnMeta[],
  rows: unknown[][],
  geocodedAddresses: Record<string, string> | undefined,
  latColumn: string | undefined,
  lonColumn: string | undefined,
  gpsPairs?: GeocodePair[]
): { columns: ColumnMeta[]; rows: unknown[][] } {
  if (!geocodedAddresses || Object.keys(geocodedAddresses).length === 0) {
    return { columns, rows };
  }

  // Build the list of pairs to process
  const pairs = gpsPairs && gpsPairs.length > 0
    ? gpsPairs
    : (latColumn && lonColumn ? [{ latColumn, lonColumn }] : []);

  if (pairs.length === 0) {
    return { columns, rows };
  }

  // Resolve column indices for each pair
  const resolvedPairs = pairs
    .map(p => ({
      latIdx: columns.findIndex(c => c.name === p.latColumn),
      lonIdx: columns.findIndex(c => c.name === p.lonColumn),
      latName: p.latColumn,
    }))
    .filter(p => p.latIdx !== -1 && p.lonIdx !== -1);

  if (resolvedPairs.length === 0) {
    return { columns, rows };
  }

  const lonIdxSet = new Set(resolvedPairs.map(p => p.lonIdx));

  // Build new columns: replace each lat column with Address, remove each lon column
  const newColumns = columns
    .map((col, idx) => {
      const pair = resolvedPairs.find(p => p.latIdx === idx);
      if (pair) return { name: addressLabel(pair.latName), type: 'text' };
      if (lonIdxSet.has(idx)) return null;
      return col;
    })
    .filter((col): col is ColumnMeta => col !== null);

  // Transform rows
  const newRows = rows.map(row => {
    return row
      .map((cell, idx) => {
        const pair = resolvedPairs.find(p => p.latIdx === idx);
        if (pair) {
          const lat = parseFloat(String(row[pair.latIdx]));
          const lng = parseFloat(String(row[pair.lonIdx]));
          // A pair with no coordinates on this row (e.g. an all-NULL start_lat/
          // start_lon pair that detection surfaced by name) must not emit a
          // literal "NaN, NaN" into the Address column — leave it blank.
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
          const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
          return geocodedAddresses[key] || `${lat}, ${lng}`;
        }
        if (lonIdxSet.has(idx)) return null;
        return cell;
      })
      .filter((_, idx) => !lonIdxSet.has(idx));
  });

  return { columns: newColumns, rows: newRows };
}
