import { logger } from './logger.js';

/**
 * Loosely-typed shape for values caught in `catch` blocks.
 *
 * Catch bindings are `unknown` under `strict`/`useUnknownInCatchVariables`.
 * Node and `pg` errors carry these fields; casting a caught value to this
 * interface lets call sites read them without resorting to `any`.
 *
 * A parallel `ErrorWithMeta` lives in `src/utils/errors.ts` (frontend) with
 * browser/axios fields (`response`, `status`). The two are intentionally kept
 * separate — different runtimes, different error shapes, and independent build
 * targets — rather than unified into a shared package.
 */
export interface ErrorWithMeta {
  name?: string;
  message?: string;
  /** pg/Node error code, e.g. 'ECONNREFUSED' or a SQLSTATE like '42P01'. */
  code?: string;
  /** pg error detail/hint/position fields. */
  detail?: string;
  hint?: string;
  position?: string;
  stack?: string;
  /** HTTP status carried by app-level errors (e.g. CustomError). */
  statusCode?: number;
}

/** Narrow an unknown caught value to {@link ErrorWithMeta}. */
export function toErrorMeta(error: unknown): ErrorWithMeta {
  if (process.env.NODE_ENV !== 'production' && (error === null || error === undefined)) {
    // A caught value should never be nullish — surface the suspicious call
    // outside production so the empty-object fallback doesn't hide it.
    logger.warn('[toErrorMeta] received a null/undefined error; defaulting to empty meta.');
  }
  return (error ?? {}) as ErrorWithMeta;
}

/**
 * Node socket / pg SQLSTATE codes that mean a *transient connectivity* failure
 * to a Postgres server — the server was briefly unreachable, not that the query
 * was bad. These are the symptoms behind DO-287 / the Jun-2026 incident, where
 * the external settings DB dropped TLS handshakes and timed out connections.
 *
 * Deliberately excludes query-level SQLSTATEs (42P01 undefined_table, 25006
 * read_only_sql_transaction, 23505 unique_violation, …): those are deterministic
 * faults that a retry would only repeat.
 */
export const TRANSIENT_DB_ERROR_CODES: ReadonlySet<string> = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND',
  'EAI_AGAIN', 'ESOCKETTIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH',
  '57P03', // cannot_connect_now (server starting up / shutting down)
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
]);

const TRANSIENT_DB_MESSAGE_RE =
  /socket disconnected before secure TLS|connection terminated|connection timeout|timeout expired|terminating connection|server closed the connection|read ECONNRESET/i;

/**
 * Whether a caught value looks like a transient DB connection failure that is
 * safe to retry for an idempotent read. Walks the `cause` chain (bounded) since
 * pg/stream wrappers often nest the original socket error.
 */
export function isTransientDbError(error: unknown): boolean {
  for (let cur: unknown = error, depth = 0; cur != null && depth < 5; depth++) {
    const e = cur as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof e.code === 'string' && TRANSIENT_DB_ERROR_CODES.has(e.code)) return true;
    if (typeof e.message === 'string' && TRANSIENT_DB_MESSAGE_RE.test(e.message)) return true;
    cur = e.cause;
  }
  return false;
}
