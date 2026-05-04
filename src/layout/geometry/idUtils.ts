/**
 * Utilities for safe panel/row ID comparisons.
 * Panel IDs can be numbers (from Grafana JSON) or strings (UUIDs, drag-event extraction).
 * All comparisons must normalize to string to avoid strict-equality mismatches.
 */

export type PanelId = string | number;

export function idEq(a: PanelId | undefined | null, b: PanelId | undefined | null): boolean {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export function idIncludes(ids: PanelId[], id: PanelId | undefined | null): boolean {
  if (id == null) return false;
  const s = String(id);
  return ids.some(item => String(item) === s);
}

export function idIndexOf(ids: PanelId[], id: PanelId): number {
  const s = String(id);
  return ids.findIndex(item => String(item) === s);
}

export function naturalIdCompare(a: PanelId | undefined, b: PanelId | undefined): number {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}
