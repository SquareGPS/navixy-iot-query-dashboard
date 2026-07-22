import type { AgentService } from './types.js';
import { mockAgentService } from './mockAgent.js';
import { bedrockAgentService } from './bedrockAgent.js';
import { logger } from '../../utils/logger.js';

// No config module exists in this backend — process.env is read inline at each use site.
// Do not add one for this feature.
const AGENT_BACKEND = (process.env.AGENT_BACKEND ?? 'mock').trim().toLowerCase();

/** Exported for tests only. Under ESM + --experimental-vm-modules there is no
 *  usable fresh-module-registry-per-case (and no mocking library is wanted), so
 *  the selection branch is asserted through this pure function instead of
 *  re-importing the module under a different env. */
export function pickAgent(backend: string): AgentService {
  return backend === 'bedrock' ? bedrockAgentService : mockAgentService;
}

/**
 * THE SWAP POINT. Selected ONCE at module load — never per-method, never per-request.
 * Contrast src/services/api.ts, which repeats `if (isDemoMode())` in ~35 methods and
 * silently breaks demo users on the one that gets missed.
 *
 * TO SHIP THE REAL AGENT: set AGENT_BACKEND=bedrock plus BEDROCK_AGENT_ID,
 * BEDROCK_AGENT_ALIAS_ID and AWS_REGION in backend/.env.docker. ZERO code change here. The
 * route, the validator, the rate limiter, the deadline, the error taxonomy and the chat
 * store are all unaffected, and so is the FRONTEND: latency is settled at ~7-8s for
 * questions and ~36s for builds — confirmed by the agent's author and measured by the probe
 * — so the no-streaming decision (D6) and the 180s deadline (D21) both stand.
 */
export const agentService: AgentService = pickAgent(AGENT_BACKEND);

logger.info('Agent service initialised', { kind: agentService.kind, backend: AGENT_BACKEND });

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
