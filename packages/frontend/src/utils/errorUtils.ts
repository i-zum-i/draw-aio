export interface ErrorInfo {
  message: string;
  type: 'error' | 'warning' | 'info';
  isRetryable: boolean;
  userAction?: string;
}

export class ErrorHandler {
  /**
   * ネットワークエラーかどうかを判定
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
   * タイムアウトエラーかどうかを判定
   */
  static isTimeoutError(error: Error): boolean {
    return (
      error.name === 'TimeoutError' ||
      error.message.includes('timeout') ||
      error.message.includes('timed out')
    );
  }

  /**
   * サーバーエラーかどうかを判定
   */
  static isServerError(status?: number): boolean {
    return status !== undefined && status >= 500;
  }

  /**
   * クライアントエラーかどうかを判定
   */
  static isClientError(status?: number): boolean {
    return status !== undefined && status >= 400 && status < 500;
  }

  /**
   * エラーを分類してユーザーフレンドリーなメッセージに変換
   */
  static categorizeError(error: Error, response?: Response): ErrorInfo {
    const status = response?.status;

    // ネットワークエラー
    if (this.isNetworkError(error)) {
      return {
        message: 'インターネット接続を確認してください。接続が安定していることを確認して再試行してください。',
        type: 'error',
        isRetryable: true,
        userAction: 'ネットワーク接続を確認して再試行'
      };
    }

    // タイムアウトエラー
    if (this.isTimeoutError(error)) {
      return {
        message: 'リクエストがタイムアウトしました。サーバーが混雑している可能性があります。しばらく待ってから再試行してください。',
        type: 'warning',
        isRetryable: true,
        userAction: 'しばらく待ってから再試行'
      };
    }

    // サーバーエラー (5xx)
    if (this.isServerError(status)) {
      return {
        message: 'サーバーで一時的な問題が発生しています。しばらく待ってから再試行してください。',
        type: 'error',
        isRetryable: true,
        userAction: 'しばらく待ってから再試行'
      };
    }

    // クライアントエラー (4xx)
    if (this.isClientError(status)) {
      if (status === 400) {
        return {
          message: '入力内容に問題があります。図の説明を確認して再度お試しください。',
          type: 'warning',
          isRetryable: true,
          userAction: '入力内容を確認して再試行'
        };
      }
      if (status === 413) {
        return {
          message: '入力テキストが長すぎます。短くしてから再試行してください。',
          type: 'warning',
          isRetryable: true,
          userAction: '入力テキストを短くして再試行'
        };
      }
      if (status === 429) {
        return {
          message: 'リクエストが多すぎます。しばらく待ってから再試行してください。',
          type: 'warning',
          isRetryable: true,
          userAction: 'しばらく待ってから再試行'
        };
      }
      return {
        message: 'リクエストに問題があります。入力内容を確認してください。',
        type: 'warning',
        isRetryable: true,
        userAction: '入力内容を確認して再試行'
      };
    }

    // その他のエラー
    return {
      message: '予期しないエラーが発生しました。しばらく待ってから再試行してください。',
      type: 'error',
      isRetryable: true,
      userAction: 'しばらく待ってから再試行'
    };
  }

  /**
   * APIレスポンスからエラー情報を抽出
   */
  static async extractErrorFromResponse(response: Response): Promise<ErrorInfo> {
    try {
      const data = await response.json();
      
      // サーバーからのエラーメッセージがある場合
      if (data.message) {
        return {
          message: data.message,
          type: this.isServerError(response.status) ? 'error' : 'warning',
          isRetryable: this.isServerError(response.status) || response.status === 429,
          userAction: this.isServerError(response.status) ? 'しばらく待ってから再試行' : '入力内容を確認して再試行'
        };
      }
    } catch (parseError) {
      // JSON解析に失敗した場合はステータスコードベースで判定
    }

    // ステータスコードベースでエラーを分類
    return this.categorizeError(new Error(`HTTP ${response.status}`), response);
  }

  /**
   * 汎用的なエラーハンドリング
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
      message: '不明なエラーが発生しました。',
      type: 'error',
      isRetryable: false
    };
  }
}

/**
 * フェッチリクエストにタイムアウトを追加
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
 * 再試行機能付きフェッチ
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
      
      // 成功またはクライアントエラーの場合は再試行しない
      if (response.ok || ErrorHandler.isClientError(response.status)) {
        return response;
      }
      
      // サーバーエラーの場合は再試行
      if (attempt < maxRetries && ErrorHandler.isServerError(response.status)) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 最後の試行でない場合は再試行
      if (attempt < maxRetries && ErrorHandler.isNetworkError(lastError)) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        continue;
      }
      
      throw lastError;
    }
  }

  throw lastError!;
}