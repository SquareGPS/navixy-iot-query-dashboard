import { describe, it, expect, beforeEach } from '@jest/globals';
import { DatabaseService } from '../database.js';

/**
 * DO-352: every execution must put its checked-out client into an explicit
 * session state — the viewer's zone when the request carries one, the server
 * default when it does not — because external pools are shared and a client
 * keeps whatever the previous renter set.
 *
 * The pool is faked at the getExternalPool seam (private, reached through a
 * cast, like export.test.ts does for the chart generators) so the assertions
 * see the exact statements a real client would receive.
 */

interface RecordedQuery {
  text: string;
  values?: unknown[];
}

interface QueryArg {
  text?: string;
  rowMode?: string;
}

function makeFakeClient(failOnSetConfig = false) {
  const queries: RecordedQuery[] = [];
  let released = false;
  const client = {
    query: async (arg: string | QueryArg, values?: unknown[]) => {
      const text = typeof arg === 'string' ? arg : arg.text ?? '';
      queries.push({ text, values });
      if (failOnSetConfig && text.includes('set_config')) {
        throw Object.assign(
          new Error('invalid value for parameter "TimeZone": "Pacific/Kanton"'),
          { code: '22023' },
        );
      }
      return { rows: [], fields: [] };
    },
    release: () => {
      released = true;
    },
  };
  return { client, queries, isReleased: () => released };
}

type PoolSeam = {
  getExternalDatabaseConfig: (url: string) => Promise<unknown>;
  getExternalPool: (config: unknown) => Promise<unknown>;
};

function stubPool(service: DatabaseService, connect: () => Promise<unknown>) {
  const seam = service as unknown as PoolSeam;
  seam.getExternalDatabaseConfig = async () => ({});
  seam.getExternalPool = async () => ({ connect });
}

const IOT_DB_URL = 'postgresql://user:pw@example.test:5432/db';

describe('executeParameterizedQuery session state', () => {
  let service: DatabaseService;

  beforeEach(() => {
    // A fresh instance per test: the singleton would otherwise carry the
    // previous test's stubbed pool seam.
    service = new DatabaseService();
  });

  it('applies the timezone and timeout through a single bound set_config call', async () => {
    const { client, queries, isReleased } = makeFakeClient();
    stubPool(service, async () => client);

    await service.executeParameterizedQuery(
      'SELECT 1', {}, 12345, 100, IOT_DB_URL, undefined, 'Europe/Berlin',
    );

    expect(queries[0]).toEqual({
      text: "SELECT set_config('statement_timeout', $1, false), set_config('TimeZone', $2, false)",
      values: ['12345', 'Europe/Berlin'],
    });
    // The user's query still ran after session setup.
    expect(queries.some((q) => q.text.startsWith('SELECT 1'))).toBe(true);
    expect(isReleased()).toBe(true);
  });

  it('resets the timezone when the request carries none', async () => {
    const { client, queries } = makeFakeClient();
    stubPool(service, async () => client);

    await service.executeParameterizedQuery('SELECT 1', {}, 12345, 100, IOT_DB_URL);

    expect(queries[0]?.text).toBe('SET statement_timeout = 12345; RESET TIME ZONE');
    expect(queries[0]?.values).toBeUndefined();
  });

  it('falls back to the server default when the database rejects the zone', async () => {
    // Intl and the server tzdata ship separately, so a zone can pass
    // sanitizeTimeZone (Pacific/Kanton is Intl-valid) and still be unknown to
    // an older server's tzdata — the fake models that by rejecting the
    // set_config with 22023. The panel must then render in the session
    // default rather than fail.
    const { client, queries } = makeFakeClient(true);
    stubPool(service, async () => client);

    const result = await service.executeParameterizedQuery(
      'SELECT 1', {}, 12345, 100, IOT_DB_URL, undefined, 'Pacific/Kanton',
    );

    expect(queries[0]?.text).toContain('set_config');
    expect(queries[1]?.text).toBe('SET statement_timeout = 12345; RESET TIME ZONE');
    expect(queries.some((q) => q.text.startsWith('SELECT 1'))).toBe(true);
    expect(result.stats?.rowCount).toBe(0);
  });

  it('strips a zone that fails sanitizeTimeZone before it reaches the session', async () => {
    // The choke-point re-validation: export routes resolve their zone from
    // request bodies / stored preferences, so executeParameterizedQuery must
    // not trust its caller. A bare offset (Intl-valid, POSIX-inverted in
    // Postgres) degrades to the RESET path — no set_config ever fires.
    const { client, queries } = makeFakeClient();
    stubPool(service, async () => client);

    await service.executeParameterizedQuery(
      'SELECT 1', {}, 12345, 100, IOT_DB_URL, undefined, '+05:00',
    );

    expect(queries[0]?.text).toBe('SET statement_timeout = 12345; RESET TIME ZONE');
    expect(queries.every((q) => !q.text.includes('set_config'))).toBe(true);
  });

  it('never interpolates a non-numeric timeout into the SET statement', async () => {
    // limits.timeout_ms is client-typed only; anything non-numeric must be
    // replaced by the default, not concatenated into the session SET.
    const { client, queries } = makeFakeClient();
    stubPool(service, async () => client);

    await service.executeParameterizedQuery(
      'SELECT 1', {}, '1; SELECT pg_sleep(9)' as unknown as number, 100, IOT_DB_URL,
    );

    expect(queries[0]?.text).toBe('SET statement_timeout = 30000; RESET TIME ZONE');
    expect(queries.every((q) => !q.text.includes('pg_sleep'))).toBe(true);
  });

  it('floors a fractional timeout to whole milliseconds', async () => {
    const { client, queries } = makeFakeClient();
    stubPool(service, async () => client);

    await service.executeParameterizedQuery(
      'SELECT 1', {}, 1500.75, 100, IOT_DB_URL, undefined, 'Europe/Berlin',
    );

    expect(queries[0]?.values).toEqual(['1500', 'Europe/Berlin']);
  });

  it.each([[0], [-100], [0.5]])(
    'replaces the non-positive timeout %p with the default instead of disabling it',
    async (timeoutMs) => {
      // statement_timeout = 0 means "no timeout" to Postgres, so a value that
      // floors to 0 must fall back to the default, never reach the session.
      const { client, queries } = makeFakeClient();
      stubPool(service, async () => client);

      await service.executeParameterizedQuery('SELECT 1', {}, timeoutMs, 100, IOT_DB_URL);

      expect(queries[0]?.text).toBe('SET statement_timeout = 30000; RESET TIME ZONE');
    },
  );

  it('clamps a timeout beyond the int4 GUC range to the Postgres maximum', async () => {
    // Anything above int4 max would fail the SET itself and with it the query.
    const { client, queries } = makeFakeClient();
    stubPool(service, async () => client);

    await service.executeParameterizedQuery(
      'SELECT 1', {}, 9999999999, 100, IOT_DB_URL, undefined, 'Europe/Berlin',
    );

    expect(queries[0]?.values).toEqual(['2147483647', 'Europe/Berlin']);
  });
});

describe('legacy execution paths reset the session zone', () => {
  // /table and /tile never take a zone, so their whole DO-352 surface is the
  // RESET guard: without it they would inherit whatever zone the previous
  // renter of the pooled connection set.
  let service: DatabaseService;

  beforeEach(() => {
    service = new DatabaseService();
  });

  it('executeTableQuery resets the timezone before running the query', async () => {
    const { client, queries, isReleased } = makeFakeClient();
    stubPool(service, async () => client);

    await service.executeTableQuery('SELECT 1', 1, 25, undefined, IOT_DB_URL, 12345);

    expect(queries[0]?.text).toBe('SET statement_timeout = 12345; RESET TIME ZONE');
    expect(queries[0]?.values).toBeUndefined();
    expect(queries.length).toBeGreaterThan(1);
    expect(isReleased()).toBe(true);
  });

  it('executeTileQuery resets the timezone before running the query', async () => {
    const { client, queries, isReleased } = makeFakeClient();
    stubPool(service, async () => client);

    await service.executeTileQuery('SELECT 1', IOT_DB_URL, 12345);

    expect(queries[0]?.text).toBe('SET statement_timeout = 12345; RESET TIME ZONE');
    expect(queries[0]?.values).toBeUndefined();
    expect(queries.length).toBeGreaterThan(1);
    expect(isReleased()).toBe(true);
  });
});
