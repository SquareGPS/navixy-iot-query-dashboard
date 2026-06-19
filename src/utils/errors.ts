/**
 * Loosely-typed shape for values caught in `catch` blocks.
 *
 * Catch bindings are `unknown` under `strict`/`useUnknownInCatchVariables`.
 * Network/runtime errors commonly carry these fields; casting a caught value to
 * this interface lets call sites read them without resorting to `any`.
 *
 * A parallel `ErrorWithMeta` lives in `backend/src/utils/errors.ts` with
 * backend-specific fields (pg `detail`/`hint`/`position`, `statusCode`). The two
 * are intentionally kept separate — different runtimes, different error shapes,
 * and independent build targets — rather than unified into a shared package.
 */
export interface ErrorWithMeta {
  name?: string;
  message?: string;
  /** App/HTTP error code (e.g. 'NETWORK_ERROR' or a SQLSTATE). */
  code?: string;
  status?: number;
  stack?: string;
  /** Present on axios-style errors. */
  response?: { status?: number; data?: unknown };
}

/** Narrow an unknown caught value to {@link ErrorWithMeta}. */
export function toErrorMeta(error: unknown): ErrorWithMeta {
  if (import.meta.env.DEV && (error === null || error === undefined)) {
    // A caught value should never be nullish — surface the suspicious call in
    // dev so the empty-object fallback below doesn't silently swallow it.
    console.warn('[toErrorMeta] received a null/undefined error; defaulting to empty meta.');
  }
  return (error ?? {}) as ErrorWithMeta;
}

/** Extract a human-readable message from an unknown caught value. */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (error instanceof Error) return error.message;
  const meta = toErrorMeta(error);
  return meta.message ?? fallback;
}
