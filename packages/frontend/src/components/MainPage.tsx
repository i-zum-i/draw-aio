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
    setLastPrompt(text); // Save for retry
    await performDiagramGeneration(text);
  };

  const performDiagramGeneration = async (text: string) => {
    setIsLoading(true);
    setErrorInfo(null);
    setResult(null);

    // Check network status
    if (!networkStatus.isOnline) {
      setErrorInfo({
        message: 'No internet connection. Please check your connection and try again.',
        type: 'error',
        isRetryable: true,
        userAction: 'Check network connection and retry'
      });
      setIsLoading(false);
      return;
    }

    // Warning for slow connection
    if (networkStatus.isSlowConnection) {
      setErrorInfo({
        message: 'Slow connection detected. Processing may take longer than usual.',
        type: 'info',
        isRetryable: false
      });
    }

    const timeout = getTimeoutForConnection(networkStatus.connectionType);
    const startTime = Date.now();
    
    try {
      
      const response = await fetchWithRetry('/api/generate-diagram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: text }),
      }, 2, 1000, timeout); // Max 2 retries, 1 second interval, dynamic timeout
      

      if (response.ok) {
        const data: DiagramResponse = await response.json();
        
        if (data.status === 'success') {
          setResult(data);
          setRetryCount(0); // Reset retry count on success
        } else {
          // Error response from server
          setErrorInfo({
            message: data.message || 'Failed to generate diagram.',
            type: 'error',
            isRetryable: true,
            userAction: 'Check input and try again'
          });
        }
      } else {
        // HTTP error response
        const errorInfo = await ErrorHandler.extractErrorFromResponse(response);
        setErrorInfo(errorInfo);
      }
    } catch (err) {
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

  const handleClear = () => {
    setResult(null);
    setErrorInfo(null);
    setRetryCount(0);
    setLastPrompt('');
  };

  return (
    <div className="main-page">
      <ConnectionStatus />
      <Header title="AI Diagram Generator" />
      
      <main className="main-content">
        <div className="container">
          <div className="intro-section">
            <p className="intro-text">
              Automatically generate Draw.io diagrams from natural language descriptions.
              Please describe the diagram you want to create.
            </p>
          </div>
          
          <InputForm 
            onSubmit={handleFormSubmit} 
            onClear={handleClear}
            isLoading={isLoading} 
            hasResult={!!result}
          />
          
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