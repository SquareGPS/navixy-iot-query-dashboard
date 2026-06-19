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
