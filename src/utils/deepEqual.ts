/**
 * Structural deep equality for plain JSON-like values (primitives, arrays and
 * plain objects). Object key order is ignored; two objects are equal when they
 * have the same keys and every value is deeply equal.
 *
 * This exists to compare configuration/form snapshots — e.g. the panel editor
 * gates its Save button on whether the current draft still equals the panel as
 * loaded (DO-307). It is deliberately not a general-purpose isEqual: Map, Set,
 * Date, RegExp and other exotic types are compared by reference only. The panel
 * draft it is used on is JSON that has round-tripped through the server, so it
 * only ever contains primitives, arrays and plain objects.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  // Past the identity check, only two plain objects/arrays can still be equal.
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray && bIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}
