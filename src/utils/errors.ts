/**
 * Loosely-typed shape for values caught in `catch` blocks.
 *
 * Catch bindings are `unknown` under `strict`/`useUnknownInCatchVariables`.
 * Network/runtime errors commonly carry these fields; casting a caught value to
 * this interface lets call sites read them without resorting to `any`.
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
  return (error ?? {}) as ErrorWithMeta;
}

/** Extract a human-readable message from an unknown caught value. */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (error instanceof Error) return error.message;
  const meta = toErrorMeta(error);
  return meta.message ?? fallback;
}
