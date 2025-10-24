import type { Request, Response, NextFunction } from 'express';
import { SQLSelectGuard, SelectValidationError } from './sqlSelectGuard.js';
import { logger } from './logger.js';

export interface ValidationErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      issues: Array<{
        code: string;
        message: string;
      }>;
    };
  };
}

/**
 * Middleware to validate SQL queries using SQLSelectGuard
 * This should be used before executing any user-provided SQL
 */
export function validateSQLQuery(req: Request, res: Response, next: NextFunction): void | Response {
  const { sql } = req.body;

  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_SQL',
        message: 'SQL query is required and must be a string'
      }
    });
  }

  try {
    SQLSelectGuard.assertSafeSelect(sql);
    next();
  } catch (error) {
    if (error instanceof SelectValidationError) {
      logger.warn('SQL validation failed:', {
        userId: (req as any).user?.userId,
        sql: sql.substring(0, 100) + '...',
        issues: error.issues
      });

      const response: ValidationErrorResponse = {
        error: {
          code: 'SQL_VALIDATION_ERROR',
          message: 'SQL query validation failed',
          details: {
            issues: error.issues
          }
        }
      };

      return res.status(422).json(response);
    }

    logger.error('Unexpected SQL validation error:', {
      userId: (req as any).user?.userId,
      sql: sql.substring(0, 100) + '...',
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during SQL validation'
      }
    });
  }
}

/**
 * Validate SQL query and return validation result without throwing
 * Useful for non-middleware contexts
 */
export function validateSQLQuerySafe(sql: string): {
  valid: boolean;
  error?: ValidationErrorResponse;
} {
  if (!sql || typeof sql !== 'string') {
    return {
      valid: false,
      error: {
        error: {
          code: 'INVALID_SQL',
          message: 'SQL query is required and must be a string'
        }
      }
    };
  }

  const result = SQLSelectGuard.validate(sql);
  
  if (result.valid) {
    return { valid: true };
  }

  return {
    valid: false,
    error: {
      error: {
        code: 'SQL_VALIDATION_ERROR',
        message: 'SQL query validation failed',
        details: {
          issues: result.issues
        }
      }
    }
  };
}

/**
 * Express route handler wrapper that automatically validates SQL
 * Usage: router.post('/endpoint', validateSQL, (req, res) => { ... })
 */
export function withSQLValidation(handler: (req: Request, res: Response, next: NextFunction) => void) {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const result = validateSQLQuery(req, res, (err) => {
      if (err) {
        return next(err);
      }
      handler(req, res, next);
    });
    
    if (result) {
      return result;
    }
  };
}

/**
 * Utility function to create standardized error responses
 */
export function createValidationErrorResponse(issues: Array<{ code: string; message: string }>): ValidationErrorResponse {
  return {
    error: {
      code: 'SQL_VALIDATION_ERROR',
      message: 'SQL query validation failed',
      details: {
        issues
      }
    }
  };
}

/**
 * Check if a response is a validation error
 */
export function isValidationErrorResponse(response: any): response is ValidationErrorResponse {
  return response?.error?.code === 'SQL_VALIDATION_ERROR' && 
         response?.error?.details?.issues &&
         Array.isArray(response.error.details.issues);
}

/**
 * Extract validation issues from a validation error response
 */
export function extractValidationIssues(response: ValidationErrorResponse): Array<{ code: string; message: string }> {
  return response.error.details?.issues || [];
}

/**
 * Get a user-friendly error message from validation issues
 */
export function getUserFriendlyErrorMessage(issues: Array<{ code: string; message: string }>): string {
  if (issues.length === 0) {
    return 'SQL query validation failed';
  }

  if (issues.length === 1) {
    return issues[0]?.message || 'SQL query validation failed';
  }

  const issueMessages = issues.map(issue => issue.message).join('; ');
  return `Multiple validation errors: ${issueMessages}`;
}
