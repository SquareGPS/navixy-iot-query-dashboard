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
    const isClientAbort =
      code === 'ECONNRESET' ||
      code === 'ERR_STREAM_PREMATURE_CLOSE' ||
      /aborted|premature close/i.test(message ?? '');
    if (isClientAbort) {
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

