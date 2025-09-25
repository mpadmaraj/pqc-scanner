/**
 * Input Validation Middleware
 * 
 * Provides centralized request validation using Zod schemas
 * Automatically handles validation errors and provides consistent error responses
 */
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

/**
 * Validation middleware factory
 * @param schema - Zod schema to validate request body against
 * @returns Express middleware function
 */
export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and parse the request body
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
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
      
      // Handle unexpected validation errors
      console.error('Validation middleware error:', error);
      res.status(500).json({ 
        error: 'Internal validation error' 
      });
    }
  };
}

/**
 * Query parameter validation middleware
 * @param schema - Zod schema to validate query parameters
 * @returns Express middleware function
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Query validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      
      console.error('Query validation middleware error:', error);
      res.status(500).json({ 
        error: 'Internal validation error' 
      });
    }
  };
}

/**
 * Path parameter validation middleware
 * @param schema - Zod schema to validate path parameters
 * @returns Express middleware function
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Parameter validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        });
      }
      
      console.error('Parameter validation middleware error:', error);
      res.status(500).json({ 
        error: 'Internal validation error' 
      });
    }
  };
}