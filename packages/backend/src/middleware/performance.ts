import { Request, Response, NextFunction } from 'express';

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          status: 'error',
          message: 'リクエストがタイムアウトしました。しばらく待ってから再試行してください。',
          code: 'REQUEST_TIMEOUT'
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

// Rate limiting middleware (simple in-memory implementation)
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

export const rateLimit = (maxRequests: number = 10, windowMs: number = 60000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    Object.keys(rateLimitStore).forEach(key => {
      if (rateLimitStore[key].resetTime < now) {
        delete rateLimitStore[key];
      }
    });

    if (!rateLimitStore[clientId]) {
      rateLimitStore[clientId] = {
        count: 1,
        resetTime: now + windowMs
      };
    } else if (rateLimitStore[clientId].resetTime < now) {
      rateLimitStore[clientId] = {
        count: 1,
        resetTime: now + windowMs
      };
    } else {
      rateLimitStore[clientId].count++;
    }

    const { count, resetTime } = rateLimitStore[clientId];

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - count).toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
    });

    if (count > maxRequests) {
      return res.status(429).json({
        status: 'error',
        message: 'リクエスト制限に達しました。しばらく待ってから再試行してください。',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((resetTime - now) / 1000)
      });
    }

    next();
  };
};

// Response compression for JSON
export const compressResponse = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data: any) {
    if (typeof data === 'object' && data !== null) {
      // Remove unnecessary whitespace from JSON responses
      const jsonString = JSON.stringify(data);
      return originalSend.call(this, jsonString);
    }
    return originalSend.call(this, data);
  };
  
  next();
};

// Request logging for performance monitoring
export const performanceLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, url } = req;
    const { statusCode } = res;
    
    // Log slow requests (> 5 seconds)
    if (duration > 5000) {
      console.warn(`🐌 Slow request: ${method} ${url} - ${statusCode} - ${duration}ms`);
    }
    
    // Log errors
    if (statusCode >= 400) {
      console.error(`❌ Error request: ${method} ${url} - ${statusCode} - ${duration}ms`);
    }
    
    // Log successful requests in development
    if (process.env.NODE_ENV === 'development' && statusCode < 400) {
      console.log(`✅ ${method} ${url} - ${statusCode} - ${duration}ms`);
    }
  });
  
  next();
};

// Memory usage monitoring
export const memoryMonitor = (req: Request, res: Response, next: NextFunction) => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  // Warn if memory usage is high (> 500MB)
  if (heapUsedMB > 500) {
    console.warn(`⚠️ High memory usage: ${heapUsedMB}MB`);
  }
  
  // Add memory info to response headers in development
  if (process.env.NODE_ENV === 'development') {
    res.set('X-Memory-Usage', `${heapUsedMB}MB`);
  }
  
  next();
};