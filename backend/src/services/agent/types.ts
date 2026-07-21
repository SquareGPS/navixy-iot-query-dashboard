/**
 * Wire + internal contract for the AI dashboard agent (DO-313 / DO-342).
 *
 * The wire types are the PUBLIC contract of POST /api/agent/chat and GET
 * /api/agent/session, mirrored in src/types/agent.ts. Changing one side without
 * the other is a breaking change: the frontend is written against this shape and
 * MUST NOT change when the mock is replaced by the Bedrock-backed service.
 */
export type AgentChatType = 'question' | 'result' | 'error';

/** `report_schema` is the FLAT Grafana-compatible dashboard JSON described by
 *  src/types/dashboard-types.ts:6-29 (panel type union at :267-279), as rendered
 *  by the DashboardRenderer dispatch at DashboardRenderer.tsx:1932-1956.
 *  NOT src/renderer-core/schema/grafana-dashboard.ts — that file is DEAD, its
 *  {dashboard, "x-navixy"} wrapper matches no fixture, and its 7-value union
 *  omits row/bargauge/kpi/timeseries. Never point the agent spec at it.
 *
 *  `title` is DERIVED, never emitted separately by the agent: it is
 *  report_schema.title when that is a non-empty string, else the uid, else
 *  'Untitled dashboard'. See §3.4.8. */
export interface AgentChatResult {
  title: string;
  report_schema: Record<string, unknown>;
}

/** POST /api/agent/chat request body. */
export interface AgentChatRequest {
  /** Omit or null on the first turn. The SERVER is authoritative (D13): an
   *  unknown id silently yields a fresh session. It never 400s or 404s. */
  session_id?: string | null;
  message: string;
}

/** POST /api/agent/chat 200 body. Note: type:'error' arrives with HTTP 200. */
export interface AgentChatResponse {
  session_id: string;
  type: AgentChatType;
  message: string;
  result: AgentChatResult | null;
}

export interface AgentTurn {
  role: 'user' | 'assistant';
  content: string;
  /** Only ever set on assistant turns of type 'result'.
   *
   *  THIS CARRIES THE FULL DASHBOARD JSON, NEVER THE s3:// URL. The artifact is
   *  fetched exactly once, at the moment the turn is produced, and persisted
   *  here. Preview, Apply, history load and page reload all read from here and
   *  NEVER re-fetch S3. See §3.4.6 and R28. */
  result?: AgentChatResult | null;
}

/** GET /api/agent/session 200 body. */
export interface AgentSessionResponse {
  session_id: string;
  /** false when this tenant has not applied 002_add_chat_tables.sql — history is
   *  process-local and will not survive a restart. The UI surfaces this as one
   *  line of copy; it never disables anything. NOTE (D19): it says nothing about
   *  the AGENT's memory, which Bedrock holds server-side either way. */
  persisted: boolean;
  messages: AgentTurn[];
}

/** Per-request context. */
export interface AgentContext {
  userId: string;
  role: string;
  /** Stable across the whole dialogue, minted by the route. Passed VERBATIM to
   *  Bedrock as InvokeAgentCommand.sessionId — that is what its server-side
   *  conversation memory is keyed on (D19). Bedrock's pattern is
   *  [0-9a-zA-Z._:-]+, so a plain UUID is fine. */
  sessionId: string;
  /** The wall-clock deadline for the whole turn (D21). Owned by the route.
   *  Implementations MUST forward it to any outbound call — the Bedrock invoke
   *  AND the S3 fetch. The route does NOT race it against the call, so an
   *  implementation that ignores it cannot be aborted by it. */
  signal: AbortSignal;
}

export interface AgentTurnInput {
  message: string;
  /** Oldest-first, already truncated by the route.
   *
   *  READ BY THE MOCK. **IGNORED BY THE BEDROCK IMPLEMENTATION** — Bedrock keys
   *  conversation memory server-side on sessionId and receives only the newest
   *  turn. Feeding this back would double-feed every turn and degrade quality.
   *  It stays on the interface so the mock can be stateless and so a stateless
   *  agent remains implementable behind this seam without a contract change.
   *  See D19 and R18. */
  history: AgentTurn[];
}

/** session_id is deliberately absent: the route owns it, so an implementation
 *  cannot corrupt session handling. */
export type AgentTurnResult = Omit<AgentChatResponse, 'session_id'>;

/**
 * The seam. Implementations MUST be storage-free and MUST be pure functions of
 * (input, ctx). Persistence lives behind chatStore, in the route.
 */
export interface AgentService {
  /** Diagnostic only — logged at boot. */
  readonly kind: 'mock' | 'bedrock';
  chat(input: AgentTurnInput, ctx: AgentContext): Promise<AgentTurnResult>;
}
