import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const CLIENT_ABORT_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'ERR_STREAM_PREMATURE_CLOSE',
  'ERR_STREAM_DESTROYED',
  'ERR_STREAM_WRITE_AFTER_END',
]);

const CLIENT_ABORT_MESSAGE_RE = /aborted|premature close|write after end|ECONNRESET|EPIPE/i;

/**
 * Decide whether an error that surfaced *after the response started* is a
 * routine client disconnect (a cancelled download) rather than a server fault.
 *
 * When a client cancels a large streamed export, the response socket emits a
 * low-level error (ECONNRESET / EPIPE / premature close). That error is often
 * re-thrown wrapped — e.g. ExcelJS's `WorkbookWriter.commit()` rejection, or a
 * stream-pipeline wrapper — and the wrapper can drop the original `code` from
 * its top-level object. So we walk the `cause` chain (bounded) and match on a
 * known code or message at any level, instead of trusting only the top error.
 */
export function isClientAbortError(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current != null && depth < 5; depth++) {
    const e = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof e.code === 'string' && CLIENT_ABORT_CODES.has(e.code)) return true;
    if (typeof e.message === 'string' && CLIENT_ABORT_MESSAGE_RE.test(e.message)) return true;
    current = e.cause;
  }
  return false;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { statusCode = 500, message } = error;

  // If the response has already started (e.g. a streamed export that failed
  // mid-flight), we can't write a JSON error body — the status/headers are
  // gone. Delegate to Express's default handler, which aborts the connection
  // so the client sees a broken download rather than a hung request.
  if (res.headersSent) {
    // A client cancelling a large streamed download is routine, not a server
    // fault — log it at warn (no stack) so it doesn't pollute error alerting.
    const code = (error as AppError & { code?: string }).code;
    if (isClientAbortError(error)) {
      logger.warn('Client aborted in-flight response', { message, code, url: req.url });
    } else {
      logger.error('Error after response started; aborting stream', {
        message,
        url: req.url,
        stack: error.stack,
      });
    }
    return next(error);
  }

  // A handler may have optimistically set download headers (an xlsx Content-Type
  // and `Content-Disposition: attachment; filename=*.xlsx`) before a streamed
  // export failed on its very first byte — at which point headersSent is still
  // false and we fall through to the JSON error path below. Strip them so the
  // browser receives the error as JSON, not as an attachment it saves as a
  // corrupt `.xlsx`. (res.json/res.send only set Content-Type when it is unset,
  // so the stale xlsx type must be cleared explicitly.)
  res.removeHeader('Content-Disposition');
  res.removeHeader('Content-Type');

  logger.error('Error occurred:', {
    error: {
      message,
      statusCode,
      stack: error.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  // Don't leak error details in production
  const errorResponse: {
    error: { code: string; message: string };
    details?: { stack?: string | undefined; originalMessage: string };
  } = {
    error: {
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'CLIENT_ERROR',
      message: statusCode >= 500 ? 'Internal server error' : message,
    },
  };

  // Add error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = {
      stack: error.stack,
      originalMessage: message,
    };
  }

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => unknown
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

