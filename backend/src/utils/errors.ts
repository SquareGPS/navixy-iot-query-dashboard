/**
 * Loosely-typed shape for values caught in `catch` blocks.
 *
 * Catch bindings are `unknown` under `strict`/`useUnknownInCatchVariables`.
 * Node and `pg` errors carry these fields; casting a caught value to this
 * interface lets call sites read them without resorting to `any`.
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
  return (error ?? {}) as ErrorWithMeta;
}
