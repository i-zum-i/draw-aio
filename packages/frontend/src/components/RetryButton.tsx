'use client';

import React from 'react';

interface RetryButtonProps {
  onRetry: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function RetryButton({ 
  onRetry, 
  isLoading = false, 
  disabled = false,
  className = '',
  children = '再試行'
}: RetryButtonProps) {
  const handleClick = () => {
    if (!isLoading && !disabled) {
      onRetry();
    }
  };

  return (
    <button
      className={`retry-button ${isLoading ? 'loading' : ''} ${className}`}
      onClick={handleClick}
      disabled={isLoading || disabled}
      type="button"
      aria-label="再試行"
    >
      {isLoading ? (
        <>
          <span className="spinner"></span>
          再試行中...
        </>
      ) : (
        <>
          <span className="retry-icon">🔄</span>
          {children}
        </>
      )}
      
      <style jsx>{`
        .retry-button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border: none;
          padding: 0.625rem 1.25rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
          min-height: 36px;
        }
        
        .retry-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
        }
        
        .retry-button:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
        }
        
        .retry-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        
        .retry-button.loading {
          background: #9ca3af;
        }
        
        .retry-icon {
          font-size: 1rem;
          animation: none;
        }
        
        .retry-button:hover:not(:disabled) .retry-icon {
          animation: rotate 0.5s ease-in-out;
        }
        
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
          .retry-button {
            padding: 0.5rem 1rem;
            font-size: 0.8125rem;
            min-height: 32px;
          }
          
          .retry-icon {
            font-size: 0.875rem;
          }
          
          .spinner {
            width: 12px;
            height: 12px;
          }
        }
        
        @media (max-width: 480px) {
          .retry-button {
            padding: 0.4375rem 0.875rem;
            font-size: 0.75rem;
            min-height: 30px;
          }
        }
      `}</style>
    </button>
  );
}