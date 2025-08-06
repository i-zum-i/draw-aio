export interface ErrorInfo {
  message: string;
  type: 'error' | 'warning' | 'info';
  isRetryable: boolean;
  userAction?: string;
}

export class ErrorHandler {
  /**
   * Check if error is a network error
   */
  static isNetworkError(error: Error): boolean {
    return (
      error.name === 'TypeError' ||
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError')
    );
  }

  /**
   * Check if error is a timeout error
   */
  static isTimeoutError(error: Error): boolean {
    return (
      error.name === 'TimeoutError' ||
      error.message.includes('timeout') ||
      error.message.includes('timed out')
    );
  }

  /**
   * Check if error is a server error
   */
  static isServerError(status?: number): boolean {
    return status !== undefined && status >= 500;
  }

  /**
   * Check if error is a client error
   */
  static isClientError(status?: number): boolean {
    return status !== undefined && status >= 400 && status < 500;
  }

  /**
   * Categorize error and convert to user-friendly message
   */
  static categorizeError(error: Error, response?: Response): ErrorInfo {
    const status = response?.status;

    // Network error
    if (this.isNetworkError(error)) {
      return {
        message: 'Please check your internet connection. Ensure connection is stable and try again.',
        type: 'error',
        isRetryable: true,
        userAction: 'Check network connection and retry'
      };
    }

    // Timeout error
    if (this.isTimeoutError(error)) {
      return {
        message: 'Request timed out. Server might be busy. Please wait and try again.',
        type: 'warning',
        isRetryable: true,
        userAction: 'Wait and try again'
      };
    }

    // Server error (5xx)
    if (this.isServerError(status)) {
      return {
        message: 'Server is experiencing temporary issues. Please wait and try again.',
        type: 'error',
        isRetryable: true,
        userAction: 'Wait and try again'
      };
    }

    // Client error (4xx)
    if (this.isClientError(status)) {
      if (status === 400) {
        return {
          message: 'Input content has issues. Please check the diagram description and try again.',
          type: 'warning',
          isRetryable: true,
          userAction: 'Check input content and retry'
        };
      }
      if (status === 413) {
        return {
          message: 'Input text is too long. Please shorten it and try again.',
          type: 'warning',
          isRetryable: true,
          userAction: 'Shorten input text and retry'
        };
      }
      if (status === 429) {
        return {
          message: 'Too many requests. Please wait and try again.',
          type: 'warning',
          isRetryable: true,
          userAction: 'Wait and try again'
        };
      }
      return {
        message: 'Request has issues. Please check the input content.',
        type: 'warning',
        isRetryable: true,
        userAction: 'Check input content and retry'
      };
    }

    // Other errors
    return {
      message: 'An unexpected error occurred. Please wait and try again.',
      type: 'error',
      isRetryable: true,
      userAction: 'Wait and try again'
    };
  }

  /**
   * Extract error information from API response
   */
  static async extractErrorFromResponse(response: Response): Promise<ErrorInfo> {
    try {
      const data = await response.json();
      
      // If server provides error message
      if (data.message) {
        return {
          message: data.message,
          type: this.isServerError(response.status) ? 'error' : 'warning',
          isRetryable: this.isServerError(response.status) || response.status === 429,
          userAction: this.isServerError(response.status) ? 'Wait and try again' : 'Check input content and retry'
        };
      }
    } catch (parseError) {
      // If JSON parsing fails, categorize based on status code
    }

    // Categorize error based on status code
    return this.categorizeError(new Error(`HTTP ${response.status}`), response);
  }

  /**
   * Generic error handling
   */
  static handleError(error: unknown, response?: Response): ErrorInfo {
    if (error instanceof Error) {
      return this.categorizeError(error, response);
    }
    
    if (typeof error === 'string') {
      return {
        message: error,
        type: 'error',
        isRetryable: false
      };
    }

    return {
      message: 'Unknown error occurred.',
      type: 'error',
      isRetryable: false
    };
  }
}

/**
 * Add timeout to fetch requests
 */
export function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeoutMs: number = 60000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).then(response => {
    clearTimeout(timeoutId);
    return response;
  }).catch(error => {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  });
}

/**
 * Fetch with retry functionality
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  retryDelay: number = 1000,
  timeoutMs: number = 60000
): Promise<Response> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      
      // Don't retry on success or client errors
      if (response.ok || ErrorHandler.isClientError(response.status)) {
        return response;
      }
      
      // Retry on server errors
      if (attempt < maxRetries && ErrorHandler.isServerError(response.status)) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Retry if not the last attempt
      if (attempt < maxRetries && ErrorHandler.isNetworkError(lastError)) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        continue;
      }
      
      throw lastError;
    }
  }

  throw lastError!;
}