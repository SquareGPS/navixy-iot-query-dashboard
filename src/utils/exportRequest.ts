/**
 * Timezone-coherent assembly of a composite-report export request.
 *
 * An export re-runs the query server-side, so its request carries BOTH the
 * datetime parameter instants and the zone the SQL session should run in.
 * Those two must describe one zone: the datetime parameters are naive
 * wall-clock strings from datetime-local inputs, and the UTC instant they
 * resolve to depends entirely on the zone they are read in. If the parameters
 * are normalized in one zone while the request declares another, the server
 * re-runs the export against an instant offset from its own session zone
 * (DO-352 review round 8: the object literal evaluated `params:
 * buildQueryParams()` in the stale render zone before the spread that
 * resampled `timeZone`, so an unobserved Berlin->Tokyo host move sent the
 * parameters eight hours away from the zone the same request declared).
 *
 * `buildExportZoneFields` takes a SINGLE resolved zone and feeds it to both
 * halves. The caller resamples the host zone once at export time and hands
 * the result in, so it cannot give the parameters and the preferences
 * different zones — passing one value makes the split structurally impossible
 * rather than merely avoided by ordering the object keys carefully.
 */
import { filterUsedParameters } from './sqlParameterExtractor';
import { normaliseParamForApi, type DateFormat, type TimeFormat } from './datetime';

/**
 * Normalize the datetime-bearing, actually-used query params for the API,
 * interpreting naive datetime-local values in `timeZone`. Shared by live
 * execution (render-state zone) and export (freshly resampled zone) so both
 * read one normalization path.
 */
export function normaliseUsedParams(
  sqlQuery: string,
  parameterValues: Record<string, unknown>,
  timeZone: string | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  const filtered = filterUsedParameters(sqlQuery, parameterValues);
  Object.entries(filtered).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'string' && v.trim() === '') return;
    merged[k] = normaliseParamForApi(k, v, { timeZone });
  });
  return merged;
}

export interface ExportPrefsFields {
  timeZone?: string;
  // The narrow union types the export API expects, not bare strings — the
  // fields are copied straight from DatetimePrefs into the request body.
  dateFormat?: DateFormat;
  timeFormat?: TimeFormat;
}

export interface ExportZoneFields {
  params: Record<string, unknown>;
  prefs: ExportPrefsFields;
}

/**
 * Build the two timezone-sensitive halves of an export request body from one
 * concrete zone: the normalized parameters and the export preferences both
 * read the SAME `timeZone`, so they can never straddle a host-zone change the
 * render state has not observed yet. `timeZone`/`dateFormat`/`timeFormat` are
 * omitted from `prefs` when empty (Intl-unusable host, or an unset format),
 * matching the backend's "field absent = session default" contract.
 */
export function buildExportZoneFields(input: {
  sqlQuery: string;
  parameterValues: Record<string, unknown>;
  timeZone: string | undefined;
  dateFormat?: DateFormat;
  timeFormat?: TimeFormat;
}): ExportZoneFields {
  const { sqlQuery, parameterValues, timeZone, dateFormat, timeFormat } = input;
  return {
    params: normaliseUsedParams(sqlQuery, parameterValues, timeZone),
    prefs: {
      ...(timeZone && { timeZone }),
      ...(dateFormat && { dateFormat }),
      ...(timeFormat && { timeFormat }),
    },
  };
}
