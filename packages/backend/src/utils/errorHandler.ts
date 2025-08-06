import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types/api';

export class AppError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

export class ErrorHandler {
  static createErrorResponse(message: string, code?: string): ErrorResponse {
    return {
      status: 'error',
      message,
      code,
    };
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log errors only in development or for critical server errors
  if (process.env.NODE_ENV === 'development') {
    console.error('Error occurred:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
    });
  }

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code || 'APP_ERROR';
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error.name === 'SyntaxError') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  }

  const errorResponse: ErrorResponse = {
    status: 'error',
    message,
    code,
  };

  res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const errorResponse: ErrorResponse = {
    status: 'error',
    message: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  };

  res.status(404).json(errorResponse);
};