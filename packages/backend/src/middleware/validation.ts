import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../utils/validation';
import { ErrorResponse } from '../types/api';

// Generic validation middleware factory
export const validateRequest = <T>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      const validatedData = schema.parse(req.body);
      
      // Replace request body with validated and sanitized data
      req.body = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(error.issues);
        
        const errorResponse: ErrorResponse = {
          status: 'error',
          message: validationError.message,
          code: 'VALIDATION_ERROR',
        };
        
        res.status(400).json(errorResponse);
        return;
      }
      
      // Pass other errors to error handler
      next(error);
    }
  };
};

// Request size validation middleware
export const validateRequestSize = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = req.get('content-length');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    const errorResponse: ErrorResponse = {
      status: 'error',
      message: 'リクエストサイズが大きすぎます（最大10MB）',
      code: 'REQUEST_TOO_LARGE',
    };
    
    res.status(413).json(errorResponse);
    return;
  }
  
  next();
};

// Rate limiting placeholder (can be enhanced with redis-based rate limiting)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const basicRateLimit = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = requestCounts.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // Reset or initialize counter
      requestCounts.set(clientId, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }
    
    if (clientData.count >= maxRequests) {
      const errorResponse: ErrorResponse = {
        status: 'error',
        message: 'リクエスト制限に達しました。しばらく待ってから再試行してください。',
        code: 'RATE_LIMIT_EXCEEDED',
      };
      
      res.status(429).json(errorResponse);
      return;
    }
    
    // Increment counter
    clientData.count++;
    next();
  };
};