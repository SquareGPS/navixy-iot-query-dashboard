import type { AgentService } from './types.js';
import { mockAgentService } from './mockAgent.js';
import { logger } from '../../utils/logger.js';

/**
 * THE SWAP POINT. MR 3 adds the AGENT_BACKEND branch here; today there is one
 * implementation. Selected ONCE at module load — never per-method, never per-request.
 * Contrast src/services/api.ts, which repeats `if (isDemoMode())` in ~35 methods and
 * silently breaks demo users on the one that gets missed.
 */
export const agentService: AgentService = mockAgentService;

// "Which agent am I running" must never be a guess.
logger.info('Agent service initialised', { kind: agentService.kind });
