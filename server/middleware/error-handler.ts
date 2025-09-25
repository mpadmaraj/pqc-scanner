/**
 * Centralized Error Handling Middleware
 * 
 * Provides consistent error responses and logging throughout the application
 * Handles different types of errors (validation, authentication, database, etc.)
 */
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Custom error interface for application errors
 */
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Creates an operational error with status code
 * @param message - Error message
 * @param statusCode - HTTP status code
 * @returns AppError instance
 */
export function createAppError(message: string, statusCode: number): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

/**
 * Async route handler wrapper to catch errors
 * @param fn - Async route handler function
 * @returns Express middleware that handles async errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handling middleware
 * Must be registered after all routes
 */
export function errorHandler(
  error: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log the error for debugging
  console.error('Error caught by middleware:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }))
    });
  }

  // Handle operational errors (errors we created)
  if ('isOperational' in error && error.isOperational) {
    return res.status(error.statusCode || 500).json({
      error: error.message
    });
  }

  // Handle database connection errors
  if (error.message.includes('connect') && error.message.includes('database')) {
    return res.status(503).json({
      error: 'Database connection error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Service temporarily unavailable'
    });
  }

  // Handle unknown errors (don't expose internal details in production)
  const message = process.env.NODE_ENV === 'development' 
    ? error.message 
    : 'Internal server error';
    
  const details = process.env.NODE_ENV === 'development' 
    ? { stack: error.stack } 
    : undefined;

  res.status(500).json({
    error: message,
    ...(details && { details })
  });
}

/**
 * 404 handler for routes that don't exist
 * Should be registered after all other routes but before error handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = createAppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
}