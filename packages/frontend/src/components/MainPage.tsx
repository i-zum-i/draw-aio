'use client';

import { useState } from 'react';
import Header from './Header';
import InputForm from './InputForm';
import ResultDisplay from './ResultDisplay';
import ErrorMessage from './ErrorMessage';
import ConnectionStatus from './ConnectionStatus';
import { DiagramResponse } from '../types';
import { ErrorHandler, ErrorInfo, fetchWithRetry } from '../utils/errorUtils';
import { useNetworkStatus, getTimeoutForConnection } from '../hooks/useNetworkStatus';

export default function MainPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagramResponse | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastPrompt, setLastPrompt] = useState<string>('');
  const networkStatus = useNetworkStatus();

  const handleFormSubmit = async (text: string) => {
    setLastPrompt(text); // 再試行用に保存
    await performDiagramGeneration(text);
  };

  const performDiagramGeneration = async (text: string) => {
    setIsLoading(true);
    setErrorInfo(null);
    setResult(null);

    // ネットワーク状態をチェック
    if (!networkStatus.isOnline) {
      setErrorInfo({
        message: 'インターネット接続がありません。接続を確認してから再試行してください。',
        type: 'error',
        isRetryable: true,
        userAction: 'ネットワーク接続を確認して再試行'
      });
      setIsLoading(false);
      return;
    }

    // 接続が遅い場合の警告
    if (networkStatus.isSlowConnection) {
      setErrorInfo({
        message: '接続が遅いため、処理に時間がかかる場合があります。',
        type: 'info',
        isRetryable: false
      });
    }

    try {
      const timeout = getTimeoutForConnection(networkStatus.connectionType);
      const response = await fetchWithRetry('/api/generate-diagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: text }),
      }, 2, 1000, timeout); // 最大2回再試行、1秒間隔、動的タイムアウト

      if (response.ok) {
        const data: DiagramResponse = await response.json();
        
        if (data.status === 'success') {
          setResult(data);
          setRetryCount(0); // 成功時はリトライカウントをリセット
        } else {
          // サーバーからのエラーレスポンス
          setErrorInfo({
            message: data.message || '図の生成に失敗しました。',
            type: 'error',
            isRetryable: true,
            userAction: '入力内容を確認して再試行'
          });
        }
      } else {
        // HTTPエラーレスポンス
        const errorInfo = await ErrorHandler.extractErrorFromResponse(response);
        setErrorInfo(errorInfo);
      }
    } catch (err) {
      console.error('API request failed:', err);
      const errorInfo = ErrorHandler.handleError(err);
      setErrorInfo(errorInfo);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    if (lastPrompt && !isLoading) {
      setRetryCount(prev => prev + 1);
      await performDiagramGeneration(lastPrompt);
    }
  };

  const handleErrorDismiss = () => {
    setErrorInfo(null);
  };

  return (
    <div className="main-page">
      <ConnectionStatus />
      <Header title="AI Diagram Generator" />
      
      <main className="main-content">
        <div className="container">
          <div className="intro-section">
            <p className="intro-text">
              自然言語の説明からDraw.io形式の図を自動生成します。
              作成したい図の内容を日本語で入力してください。
            </p>
          </div>
          
          <InputForm onSubmit={handleFormSubmit} isLoading={isLoading} />
          
          {errorInfo && (
            <ErrorMessage 
              error={errorInfo.message}
              type={errorInfo.type}
              onDismiss={handleErrorDismiss}
              onRetry={errorInfo.isRetryable ? handleRetry : undefined}
              showDismiss={true}
              showRetry={errorInfo.isRetryable && lastPrompt.length > 0}
              isRetrying={isLoading}
            />
          )}
          
          <ResultDisplay 
            result={result}
            error={null}
            onErrorDismiss={handleErrorDismiss}
          />
        </div>
      </main>
      
      <style jsx>{`
        .main-page {
          min-height: 100vh;
          background: #f8f9fa;
        }
        
        .main-content {
          padding: 0 1rem 2rem;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .intro-section {
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .intro-text {
          font-size: 1.1rem;
          color: #666;
          line-height: 1.6;
          max-width: 600px;
          margin: 0 auto;
        }
        

        
        /* Responsive Design */
        @media (max-width: 768px) {
          .main-content {
            padding: 0 0.5rem 1rem;
          }
          
          .intro-text {
            font-size: 1rem;
          }
        }
        
        @media (max-width: 480px) {
          .intro-text {
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  );
}