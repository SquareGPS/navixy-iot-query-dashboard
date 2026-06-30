import { describe, it, expect } from '@jest/globals';
import { isClientAbortError } from '../errorHandler.js';

describe('isClientAbortError', () => {
  it('matches known socket/stream abort codes at the top level', () => {
    expect(isClientAbortError({ code: 'ECONNRESET' })).toBe(true);
    expect(isClientAbortError({ code: 'EPIPE' })).toBe(true);
    expect(isClientAbortError({ code: 'ERR_STREAM_PREMATURE_CLOSE' })).toBe(true);
    expect(isClientAbortError({ code: 'ERR_STREAM_DESTROYED' })).toBe(true);
    expect(isClientAbortError({ code: 'ERR_STREAM_WRITE_AFTER_END' })).toBe(true);
  });

  it('matches on the message when the code is absent', () => {
    expect(isClientAbortError(new Error('request aborted'))).toBe(true);
    expect(isClientAbortError(new Error('premature close'))).toBe(true);
    expect(isClientAbortError(new Error('write after end'))).toBe(true);
  });

  it('walks the cause chain when a wrapper dropped the original code', () => {
    // ExcelJS / stream pipelines re-throw wrapped — the top object has no code.
    const wrapped = { message: 'Excel export failed', cause: { code: 'ECONNRESET' } };
    expect(isClientAbortError(wrapped)).toBe(true);

    const nested = { message: 'outer', cause: { message: 'mid', cause: new Error('socket aborted') } };
    expect(isClientAbortError(nested)).toBe(true);
  });

  it('returns false for genuine server errors', () => {
    expect(isClientAbortError(new Error('boom'))).toBe(false);
    expect(isClientAbortError({ code: 'ENOENT', message: 'not found' })).toBe(false);
    expect(isClientAbortError(new TypeError('cannot read properties of undefined'))).toBe(false);
  });

  it('handles null/undefined/non-objects without throwing', () => {
    expect(isClientAbortError(null)).toBe(false);
    expect(isClientAbortError(undefined)).toBe(false);
    expect(isClientAbortError('ECONNRESET')).toBe(false); // a bare string has no .code/.message
  });

  it('terminates on a cyclic cause chain (bounded depth)', () => {
    const a: { message: string; cause?: unknown } = { message: 'loop' };
    a.cause = a;
    expect(isClientAbortError(a)).toBe(false);
  });
});
