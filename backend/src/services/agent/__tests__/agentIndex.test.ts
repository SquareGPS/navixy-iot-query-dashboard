import { describe, it, expect, afterAll } from '@jest/globals';

// Each jest test FILE gets its own module registry, so the dynamic import below
// is this file's first (and only) evaluation of index.ts — the env mutation in
// the first test is what that evaluation sees. Within the module registry the
// second import returns the same instance, which is fine: pickAgent reads its
// argument, not the environment.

const savedBackend = process.env.AGENT_BACKEND;

afterAll(() => {
  if (savedBackend === undefined) delete process.env.AGENT_BACKEND;
  else process.env.AGENT_BACKEND = savedBackend;
});

describe('agent service selection (AGENT_BACKEND)', () => {
  it('defaults to the mock, so the app boots with zero AWS configuration', async () => {
    delete process.env.AGENT_BACKEND;
    const m = await import('../index.js');
    expect(m.agentService.kind).toBe('mock');
  });

  it('pickAgent defaults to the mock ONLY on absent/empty values', async () => {
    const { pickAgent } = await import('../index.js');
    expect(pickAgent(undefined).kind).toBe('mock');
    expect(pickAgent('').kind).toBe('mock');
    expect(pickAgent('   ').kind).toBe('mock');
  });

  it('pickAgent accepts exactly "mock" and "bedrock", case- and whitespace-insensitively', async () => {
    const { pickAgent } = await import('../index.js');
    expect(pickAgent('mock').kind).toBe('mock');
    expect(pickAgent(' MOCK ').kind).toBe('mock');
    expect(pickAgent('bedrock').kind).toBe('bedrock');
    expect(pickAgent(' Bedrock ').kind).toBe('bedrock');
  });

  it('pickAgent REJECTS unknown values instead of silently mocking (MR !57 review round 3)', async () => {
    const { pickAgent } = await import('../index.js');
    // The reviewer's exact scenario: a deployment typo must not boot a backend
    // that serves plausible fixture dashboards while everyone believes Bedrock
    // is live.
    expect(() => pickAgent('bedrok')).toThrow(/Unknown AGENT_BACKEND/);
    for (const junk of ['http', 'aws', 'true', '1', 'bedrock ok', 'mock,bedrock']) {
      expect(() => pickAgent(junk)).toThrow(/Unknown AGENT_BACKEND/);
    }
  });
});
