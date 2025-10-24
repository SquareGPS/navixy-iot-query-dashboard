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
  const errorResponse = {
    error: {
      code: statusCode >= 500 ? 'INTERNAL_ERROR' : 'CLIENT_ERROR',
      message: statusCode >= 500 ? 'Internal server error' : message,
    },
  };

  // Add error details in development
  if (process.env.NODE_ENV === 'development') {
    (errorResponse as any).details = {
      stack: error.stack,
      originalMessage: message,
    };
  }

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

