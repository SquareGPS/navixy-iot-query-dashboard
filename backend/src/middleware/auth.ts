import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../services/database.js';
import { logger } from '../utils/logger.js';
import { CustomError } from './errorHandler.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new CustomError('Access token required', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    // Verify user still exists and get current role
    const dbService = DatabaseService.getInstance();
    const userRole = await dbService.getUserRole(decoded.userId);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: userRole
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token:', error.message);
      next(new CustomError('Invalid token', 401));
    } else {
      logger.error('Authentication error:', error);
      next(new CustomError('Authentication failed', 401));
    }
  }
};

export const requireRole = (requiredRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new CustomError('Authentication required', 401));
      return;
    }

    if (!requiredRoles.includes(req.user.role)) {
      logger.warn(`Access denied for user ${req.user.email} with role ${req.user.role}. Required: ${requiredRoles.join(', ')}`);
      next(new CustomError('Insufficient permissions', 403));
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireAdminOrEditor = requireRole(['admin', 'editor']);