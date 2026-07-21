/**
 * The AGENT_BACKEND=mock implementation of AgentService (DO-313).
 *
 * Deterministic, stateless, storage-free: every decision is a pure function of
 * (input, ctx). It selects a known-good dashboard from AGENT_CORPUS by keyword
 * and never talks to the network, so tests are fast and offline development and
 * demos need zero AWS configuration.
 *
 * THE MOCK IS NOT A SPECIFICATION OF THE REAL AGENT. The Bedrock agent asks up
 * to five questions at once in a numbered markdown list, may return a result on
 * the first turn, and never emits type:'error' (§3.4.9). The mock's rhythm —
 * one clarifying beat, then a result — exists to exercise the UI paths, nothing
 * more. Do not tune anything against the mock alone.
 */
import type {
  AgentChatResult,
  AgentContext,
  AgentService,
  AgentTurn,
  AgentTurnInput,
  AgentTurnResult,
} from './types.js';
import { AGENT_CORPUS, DEFAULT_CORPUS_ID, type CorpusEntry } from './corpus.generated.js';

export const MENU_MESSAGE =
  'What do you want to monitor? I can build dashboards for fleet anomalies, fleet reports ' +
  'with a map, engine operation, leasing costs, vehicle mileage, or driver performance.';

/**
 * The clarifying beat is UNCONDITIONAL on a keyword match, so this wording must
 * not re-ask what the user may just have said. "Show me vehicle mileage for the
 * whole fleet over the last 30 days" is the demo path and the first thing anyone
 * will try — answering it with "Do you want this across the whole fleet, or a
 * specific period?" asks verbatim what was just stated. (Gating the beat on the
 * message lacking a scope/period signal would be more code and more failure
 * modes; deliberately not done in v1.)
 */
export const CLARIFY_MESSAGE =
  "Anything you'd like me to narrow down before I build it — a vehicle group, or a time window?";

const ERROR_MESSAGE = 'I could not complete that request. Please try again.';

const resultMessage = (title: string): string =>
  `I have built "${title}". Preview it to see it against your data, then apply it or tell me what to change.`;

/**
 * DELIBERATE, AND NOT A MODEL OF REAL AGENT BEHAVIOUR.
 *
 * Under the HTTP contract, `type:'error'` is OURS. The real Bedrock agent must never
 * emit it; an agent that cannot fulfil a request replies with a `question` explaining
 * why. No real agent will answer "cancel" with an error — it would ask what to do
 * instead.
 *
 * This branch exists SOLELY so the error UI path is reachable for real during v1.
 * Under AGENT_BACKEND=mock it is the ONLY reachable in-band error, which is why the
 * manual error-path checks depend on it. Keep it; do not let a reader mistake it for
 * agent behaviour, and do not extend it into anything resembling an error taxonomy.
 *
 * Only `stop` and `cancel` — NOT `no`/`nothing`. CLARIFY_MESSAGE asks "Anything
 * you'd like me to narrow down before I build it…?", and the natural build-it
 * answer is a leading "no": "No, that's all" must fall through to the result
 * path, not dead-end the dialogue as an error (MR !56 review finding). The two
 * remaining words keep the error path reachable at any depth.
 */
const CANCEL_RE = /^\s*(stop|cancel)\b/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Score = number of DISTINCT corpus keywords matched, case-insensitively, on word
 * boundaries, tolerating a regular plural.
 *
 * Ranking, in strict order:
 *   1. highest distinct-keyword count wins;
 *   2. ties break by AGENT_CORPUS array order;
 *   3. zero matches -> null, and the CALLER decides the fallback.
 *
 * `score > bestScore` — STRICTLY greater, so the FIRST row wins a tie. A later
 * refactor to `>=` silently inverts the tie-break; there is a test for it
 * ('idle alert' must resolve to fleet-anomaly).
 *
 * WORD-BOUNDARY ANCHORED, NOT SUBSTRING — `idle` must not match `idleness`.
 *
 * PLURAL-TOLERANT — `(?:s|es)?`. A bare \b<kw>\b does NOT match a plural, because
 * \b after the final letter requires a non-word character and `s` is a word
 * character. Measured: \balert\b does not match "alerts". Without this the whole
 * fleet-anomaly row scores zero on the most natural phrasing a user will type.
 * Verified to introduce zero new cross-row collisions across all 39 keywords.
 * `anomalies` remains an explicit table entry because (?:s|es)? cannot derive the
 * irregular y->ies form.
 */
function keywordRegex(keyword: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(keyword)}(?:s|es)?\\b`, 'i');
}

/** Exported for tests only: the plural-tolerance block asserts per-row scores
 *  that routing alone cannot isolate (a plural on one row can tie with a
 *  singular on another and be masked by the tie-break). */
export function scoreEntry(entry: CorpusEntry, haystack: string): number {
  return entry.keywords.filter((k) => keywordRegex(k).test(haystack)).length;
}

function bestMatch(haystack: string): CorpusEntry | null {
  let best: CorpusEntry | null = null;
  let bestScore = 0;
  for (const entry of AGENT_CORPUS) {
    const score = scoreEntry(entry, haystack);
    if (score > bestScore) { best = entry; bestScore = score; } // strict > ⇒ first wins ties
  }
  return best;
}

/**
 * Two-stage selection — recency beats accumulation (MR2-C2, tightened after the
 * MR !56 review). Score the newest message ALONE first; only when it matches
 * nothing, walk PRIOR USER turns newest-first and take the first that carries
 * any signal. Both halves are load-bearing:
 *
 * - Scoring the combined text unconditionally breaks the refinement-switch
 *   scenario. Measured against the literal script:
 *
 *     turn 1: "I want to track vehicle mileage"          -> vehicle-mileage 1
 *     turn 3: "actually show driver performance instead" -> driver-performance 1
 *     combined                                           -> 1-1 TIE -> array order -> vehicle-mileage
 *
 *   `vehicle-mileage` precedes `driver-performance` in corpus order, so
 *   combined-text scoring returns the dashboard the user just asked to replace.
 *
 * - CONCATENATING the fallback breaks the very next turn of that same script
 *   (MR !56 review finding): after the switch, a keyword-free refinement
 *   ("narrow it to last 7 days") re-ties mileage against driver 1-1 in the
 *   concatenated text, and array order reverts to the abandoned fixture. The
 *   newest-first walk keeps the LATEST topical signal authoritative, which is
 *   the semantically correct reading of a chat.
 *
 * Only USER turns are consulted. Assistant turns routinely carry keywords — the
 * menu names all six topics, result messages embed the dashboard title — and
 * folding them in would let the mock's own words outvote the user's.
 */
function resolveEntry(message: string, history: AgentTurn[]): CorpusEntry | null {
  const fromNewest = bestMatch(message);
  if (fromNewest) return fromNewest;

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (turn?.role !== 'user') continue;
    const match = bestMatch(turn.content);
    if (match) return match;
  }
  return null;
}

/** The throw is unreachable (a generator assertion guarantees DEFAULT_CORPUS_ID
 *  resolves), but `.find()` returns `T | undefined` under strict, and a non-null
 *  assertion here would be the one place a corpus regression becomes a TypeError
 *  at request time instead of a clear error. */
function defaultEntry(): CorpusEntry {
  const entry = AGENT_CORPUS.find((e) => e.id === DEFAULT_CORPUS_ID);
  if (!entry) {
    throw new Error(`Agent corpus integrity failure: DEFAULT_CORPUS_ID "${DEFAULT_CORPUS_ID}" is missing`);
  }
  return entry;
}

function buildResult(entry: CorpusEntry, input: AgentTurnInput, ctx: AgentContext): AgentChatResult {
  // structuredClone is MANDATORY, not hygiene. AGENT_CORPUS is a module singleton.
  // Stamping uid/id/version onto a returned reference mutates the corpus for every
  // later request in the process — a cross-request data leak that only shows up on the
  // second call, which is why there is a dedicated test for it (R15).
  // Node 17+ global; the runtime image is node:18-alpine.
  const schema = structuredClone(entry.schema) as Record<string, unknown>;

  // NOT a field on the interface. Do not add one. KNOWN LIMIT: once the route
  // (MR 4) starts truncating history to its cap, this saturates at the cap and
  // late-session results repeat a uid. Acceptable for the mock; the route owns
  // truncation and MR 4 decides whether that matters there.
  const turnIndex = input.history.length;

  schema.id = null; // 09-vehicle-mileage ships "id": 1; the other five are already null.
  // The six fixtures ship fixed uids — applying the same fixture twice would
  // otherwise produce two dashboards with one uid. This only protects the Grafana
  // uid; the DB-side slug collision is a separate problem handled in MR 6.
  schema.uid = `ai-${ctx.sessionId.slice(0, 8)}-${turnIndex}`;
  schema.version = 1;

  return {
    // The title stays the fixture's own — never translated, rewritten or appended to.
    // The SQL is coupled to what the fixture IS, and this title becomes the menu label.
    title: schema.title as string,
    report_schema: schema,
  };
}

export const mockAgentService: AgentService = {
  kind: 'mock',

  // ctx.signal is intentionally unused: there is no outbound call to cancel. This is not
  // an oversight. CONSEQUENCE: AGENT_TIMEOUT_MS is unobservable under AGENT_BACKEND=mock —
  // the route hands the signal to the implementation rather than racing it, so
  // AGENT_TIMEOUT_MS=1 produces a normal successful turn, not an error.
  //
  // No artificial delay either: the typing indicator is driven by the mutation's
  // isPending and works for both implementations.
  //
  // chat never throws: every path returns an AgentTurnResult. The only throw in
  // this module is defaultEntry()'s unreachable corpus-integrity guard.
  async chat(input: AgentTurnInput, ctx: AgentContext): Promise<AgentTurnResult> {
    // Ordered decision list — first match wins.
    // 0. Cancel words end a dialogue at any depth (checked first, unconditionally).
    if (CANCEL_RE.test(input.message)) {
      return { type: 'error', message: ERROR_MESSAGE, result: null };
    }

    // `hasAssistantTurn` — not "has a prior result", and not a count — is the
    // whole state variable.
    const hasAssistantTurn = input.history.some((t) => t.role === 'assistant');
    const entry = resolveEntry(input.message, input.history);

    // 1–2. First contact: a menu when nothing matched, one clarifying beat when
    // something did.
    if (!hasAssistantTurn) {
      return { type: 'question', message: entry ? CLARIFY_MESSAGE : MENU_MESSAGE, result: null };
    }

    // 3. Any later turn produces a result. resolveEntry already encodes the
    // refinement semantics: no new keyword -> the newest signal-bearing user turn
    // keeps the current fixture; a new keyword resolves on the new message alone
    // and switches. No extra branch is needed and none should be added.
    const result = buildResult(entry ?? defaultEntry(), input, ctx);
    return { type: 'result', message: resultMessage(result.title), result };
  },
};
