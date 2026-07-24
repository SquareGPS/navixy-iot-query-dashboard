import { describe, it, expect } from '@jest/globals';
import { generateParameterizedCacheKey } from '../sql-new.js';

/**
 * DO-352: the session timezone changes what the database renders (to_char,
 * DATE_TRUNC('day', NOW()), CURRENT_DATE), so it must partition the cache the
 * same way the statement and params do — otherwise a result rendered for one
 * viewer's zone is served to another's.
 */
describe('generateParameterizedCacheKey timezone partitioning', () => {
  const statement = "SELECT to_char(NOW(), 'HH24:MI:SS')";
  const params = { device: 42 };

  it('produces different keys for different zones', () => {
    const berlin = generateParameterizedCacheKey(statement, params, 'u1', 'db1', undefined, 'Europe/Berlin');
    const utc = generateParameterizedCacheKey(statement, params, 'u1', 'db1', undefined, 'UTC');
    expect(berlin).not.toBe(utc);
  });

  it('separates zoned requests from zone-less ones', () => {
    const zoned = generateParameterizedCacheKey(statement, params, 'u1', 'db1', undefined, 'Europe/Berlin');
    const zoneless = generateParameterizedCacheKey(statement, params, 'u1', 'db1');
    expect(zoned).not.toBe(zoneless);
  });

  it('never aliases a zone-less request to a concrete default zone', () => {
    // A regression that defaulted the missing zone (most plausibly to UTC)
    // would collide legacy zone-less entries — rendered in whatever the
    // server default is — with genuine UTC viewers.
    const zoneless = generateParameterizedCacheKey(statement, params, 'u1', 'db1');
    const utc = generateParameterizedCacheKey(statement, params, 'u1', 'db1', undefined, 'UTC');
    expect(zoneless).not.toBe(utc);
  });

  it('is stable for identical inputs', () => {
    const a = generateParameterizedCacheKey(statement, params, 'u1', 'db1', { page: 1, pageSize: 10 }, 'Europe/Berlin');
    const b = generateParameterizedCacheKey(statement, params, 'u1', 'db1', { page: 1, pageSize: 10 }, 'Europe/Berlin');
    expect(a).toBe(b);
  });
});
