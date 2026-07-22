import { describe, it, expect, afterAll } from '@jest/globals';

// A THIRD fresh-registry file (after agentIndex.test.ts and
// agentIndexBedrock.test.ts): jest gives each test FILE one module registry, so
// each import-time scenario of index.ts needs its own file. This one pins the
// MR !57 round-3 regression — an unknown AGENT_BACKEND must refuse to start,
// not silently select the mock.

const savedBackend = process.env.AGENT_BACKEND;

afterAll(() => {
  if (savedBackend === undefined) delete process.env.AGENT_BACKEND;
  else process.env.AGENT_BACKEND = savedBackend;
});

describe('agent service selection — an invalid value at import time', () => {
  it('refuses to load on a deployment typo instead of serving fixture dashboards', async () => {
    process.env.AGENT_BACKEND = 'bedrok'; // the reviewer's exact typo
    await expect(import('../index.js')).rejects.toThrow(/Unknown AGENT_BACKEND "bedrok"/);
  });
});
