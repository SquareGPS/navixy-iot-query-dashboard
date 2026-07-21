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

  it('pickAgent selects bedrock on exactly "bedrock" and the mock on everything else', async () => {
    const { pickAgent } = await import('../index.js');
    expect(pickAgent('bedrock').kind).toBe('bedrock');
    expect(pickAgent('mock').kind).toBe('mock');
    expect(pickAgent('').kind).toBe('mock');
    expect(pickAgent('http').kind).toBe('mock');
  });
});
