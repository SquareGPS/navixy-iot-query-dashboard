import { describe, it, expect, jest, afterAll } from '@jest/globals';
import { logger } from '../../../utils/logger.js';

// A SEPARATE test file from agentIndex.test.ts on purpose: jest gives each test
// FILE its own module registry, so this file's dynamic import is the only way to
// evaluate index.ts's import-time selection under AGENT_BACKEND=bedrock — the
// pickAgent unit tests cover the branch, but not the env-var → trim/lowercase →
// selection wiring itself (MR !57 review gap).

const saved = {
  backend: process.env.AGENT_BACKEND,
  bucket: process.env.BEDROCK_ARTIFACT_BUCKET,
};

afterAll(() => {
  if (saved.backend === undefined) delete process.env.AGENT_BACKEND;
  else process.env.AGENT_BACKEND = saved.backend;
  if (saved.bucket === undefined) delete process.env.BEDROCK_ARTIFACT_BUCKET;
  else process.env.BEDROCK_ARTIFACT_BUCKET = saved.bucket;
});

describe('agent service selection — the bedrock arm at import time', () => {
  it('normalizes the env value and warns at boot when the artifact bucket pin is empty', async () => {
    process.env.AGENT_BACKEND = ' Bedrock '; // exercises .trim().toLowerCase()
    delete process.env.BEDROCK_ARTIFACT_BUCKET;

    const warnSpy = jest.spyOn(logger, 'warn');
    try {
      const m = await import('../index.js');
      expect(m.agentService.kind).toBe('bedrock');

      // The empty-pin fail-open must not be silent (MR !57 review finding 3).
      const warned = warnSpy.mock.calls.some((call) =>
        String(call[0]).includes('BEDROCK_ARTIFACT_BUCKET'),
      );
      expect(warned).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
