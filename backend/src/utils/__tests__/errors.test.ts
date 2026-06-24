import { describe, it, expect } from '@jest/globals';
import { isTransientDbError, toErrorMeta } from '../errors.js';

describe('isTransientDbError', () => {
  it('flags Node socket error codes as transient', () => {
    for (const code of ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'EAI_AGAIN']) {
      expect(isTransientDbError({ code })).toBe(true);
    }
  });

  it('flags pg connection-class SQLSTATEs as transient', () => {
    for (const code of ['57P03', '08006', '08001', '08004']) {
      expect(isTransientDbError({ code })).toBe(true);
    }
  });

  it('matches the DO-287 TLS / timeout messages', () => {
    expect(
      isTransientDbError(new Error('Client network socket disconnected before secure TLS connection was established')),
    ).toBe(true);
    expect(isTransientDbError(new Error('Connection terminated due to connection timeout'))).toBe(true);
    expect(isTransientDbError(new Error('timeout expired'))).toBe(true);
  });

  it('does NOT retry genuine query faults', () => {
    // undefined_table, read_only_sql_transaction, undefined_column, unique_violation
    for (const code of ['42P01', '25006', '42703', '23505']) {
      expect(isTransientDbError({ code })).toBe(false);
    }
    expect(isTransientDbError(new Error('column "client_id" does not exist'))).toBe(false);
    expect(isTransientDbError(new Error('Composite report not found'))).toBe(false);
  });

  it('unwraps a nested cause chain', () => {
    const wrapped = new Error('Failed to get composite report');
    (wrapped as { cause?: unknown }).cause = { code: 'ECONNRESET' };
    expect(isTransientDbError(wrapped)).toBe(true);
  });

  it('is safe on nullish / odd inputs', () => {
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(undefined)).toBe(false);
    expect(isTransientDbError('ECONNRESET')).toBe(false); // a bare string has no .code/.message
    expect(isTransientDbError({})).toBe(false);
  });
});

describe('toErrorMeta', () => {
  it('passes pg error fields through', () => {
    const meta = toErrorMeta({ code: '42P01', message: 'undefined_table' });
    expect(meta.code).toBe('42P01');
    expect(meta.message).toBe('undefined_table');
  });

  it('defaults a nullish caught value to an empty object', () => {
    expect(toErrorMeta(null)).toEqual({});
    expect(toErrorMeta(undefined)).toEqual({});
  });
});
