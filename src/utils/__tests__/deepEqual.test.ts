import { describe, it, expect } from 'vitest';
import { deepEqual } from '../deepEqual';

describe('deepEqual', () => {
  it('compares primitives by value', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('a', 'b')).toBe(false);
    expect(deepEqual(0, false)).toBe(false);
  });

  it('treats null and undefined distinctly', () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual(undefined, {})).toBe(false);
  });

  it('ignores object key order', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('detects a differing nested value', () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });

  it('treats a missing key as unequal even with matching key counts', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
  });

  it('distinguishes objects that add or drop a key', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('compares arrays elementwise and by length', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([{ a: 1 }], [{ a: 1 }])).toBe(true);
    expect(deepEqual([{ a: 1 }], [{ a: 2 }])).toBe(false);
  });

  it('does not treat an array as equal to an object', () => {
    expect(deepEqual([], {})).toBe(false);
  });

  it('handles the panel-draft shapes it guards', () => {
    // No visualization on either side, empty filter bindings — a freshly opened,
    // untouched panel editor must read as unchanged.
    const pristine = {
      title: 'Sales',
      description: '',
      panelType: 'table',
      sql: 'SELECT 1',
      maxRows: 1000,
      visualization: undefined,
      textMode: 'markdown',
      textContent: '',
      filterBindings: {} as Record<string, string>,
    };
    expect(deepEqual(pristine, { ...pristine })).toBe(true);
    expect(deepEqual(pristine, { ...pristine, title: 'Revenue' })).toBe(false);
    // A visualization object toggled on where there was none is a change.
    expect(deepEqual(pristine, { ...pristine, visualization: { showHeader: false } })).toBe(false);
    // A filter binding added, then its column changed.
    expect(deepEqual(pristine, { ...pristine, filterBindings: { period: 'ts' } })).toBe(false);
    expect(
      deepEqual({ ...pristine, filterBindings: { period: 'ts' } }, { ...pristine, filterBindings: { period: 'created_at' } })
    ).toBe(false);
  });
});
