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
  it('normalizes the env value and logs the fail-closed config error at boot when the pin is empty', async () => {
    process.env.AGENT_BACKEND = ' Bedrock '; // exercises .trim().toLowerCase()
    delete process.env.BEDROCK_ARTIFACT_BUCKET;

    const errorSpy = jest.spyOn(logger, 'error');
    try {
      const m = await import('../index.js');
      expect(m.agentService.kind).toBe('bedrock');

      // An unpinned bucket now FAILS CLOSED per request (MR !57 review); the boot
      // line is how the operator learns it from the log rather than from users.
      const logged = errorSpy.mock.calls.some((call) =>
        String(call[0]).includes('BEDROCK_ARTIFACT_BUCKET'),
      );
      expect(logged).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
