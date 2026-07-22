import type { AgentService } from './types.js';
import { mockAgentService } from './mockAgent.js';
import { bedrockAgentService } from './bedrockAgent.js';
import { logger } from '../../utils/logger.js';

// No config module exists in this backend — process.env is read inline at each use site.
// Do not add one for this feature.

/** Exported for tests only. Under ESM + --experimental-vm-modules there is no
 *  usable fresh-module-registry-per-case (and no mocking library is wanted), so
 *  the selection policy is asserted through this pure function instead of
 *  re-importing the module under a different env.
 *
 *  STRICT (MR !57 review round 3): mock is the default ONLY when the variable is
 *  absent or empty. Any other value that is not exactly 'mock' / 'bedrock'
 *  (after trim + lowercase) throws — a deployment typo like `bedrok` must
 *  refuse to start, not boot a backend that serves plausible fixture dashboards
 *  while everyone believes Bedrock is live. Same posture as the JWT_SECRET
 *  check in index.ts: bad config dies at boot, loudly. */
export function pickAgent(raw: string | undefined): AgentService {
  const backend = (raw ?? '').trim().toLowerCase() || 'mock';
  if (backend === 'bedrock') return bedrockAgentService;
  if (backend === 'mock') return mockAgentService;
  throw new Error(
    `Unknown AGENT_BACKEND ${JSON.stringify(raw)} — allowed values: "mock" (the default when ` +
      'unset or empty) | "bedrock". Refusing to start rather than silently running the mock.',
  );
}

/**
 * THE SWAP POINT. Selected ONCE at module load — never per-method, never per-request.
 * Contrast src/services/api.ts, which repeats `if (isDemoMode())` in ~35 methods and
 * silently breaks demo users on the one that gets missed.
 *
 * TO SHIP THE REAL AGENT: set AGENT_BACKEND=bedrock plus BEDROCK_AGENT_ID,
 * BEDROCK_AGENT_ALIAS_ID, BEDROCK_ARTIFACT_BUCKET and AWS_REGION in backend/.env.docker.
 * ZERO code change here. The route, the validator, the rate limiter, the deadline, the
 * error taxonomy and the chat store are all unaffected, and so is the FRONTEND: latency is
 * settled at ~7-8s for questions and ~36s for builds — confirmed by the agent's author and
 * measured by the probe — so the no-streaming decision (D6) and the 180s deadline (D21)
 * both stand.
 */
export const agentService: AgentService = pickAgent(process.env.AGENT_BACKEND);

logger.info('Agent service initialised', { kind: agentService.kind });

if (agentService.kind === 'bedrock' && !process.env.BEDROCK_ARTIFACT_BUCKET?.trim()) {
  // FAIL CLOSED (MR !57 review): an unpinned bucket is a config error, not a permissive
  // dev mode — unpinned, fetchArtifact would read whatever bucket the agent's
  // LLM-generated prose names, across everything the task role can reach. So
  // buildInvokeInput refuses every turn (CustomError 500) and fetchArtifact refuses
  // every fetch until the pin is set; this boot line exists so the operator learns that
  // from the log rather than from users.
  logger.error(
    '[Agent] BEDROCK_ARTIFACT_BUCKET is not set — bedrock mode fails closed and every ' +
      'agent request will return a configuration error until the pin is configured.',
  );
}
