'use client';

import React from 'react';
import RetryButton from './RetryButton';

export interface ErrorMessageProps {
  error: string | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  type?: 'error' | 'warning' | 'info';
  showDismiss?: boolean;
  showRetry?: boolean;
  isRetrying?: boolean;
  className?: string;
}

export default function ErrorMessage({ 
  error, 
  onDismiss, 
  onRetry,
  type = 'error',
  showDismiss = true,
  showRetry = false,
  isRetrying = false,
  className = ''
}: ErrorMessageProps) {
  if (!error) return null;

  const getErrorConfig = () => {
    switch (type) {
      case 'warning':
        return {
          icon: '⚠️',
          bgGradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          borderColor: '#fbbf24',
          textColor: '#92400e',
          dismissColor: '#92400e'
        };
      case 'info':
        return {
          icon: 'ℹ️',
          bgGradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          borderColor: '#60a5fa',
          textColor: '#1e40af',
          dismissColor: '#1e40af'
        };
      default: // error
        return {
          icon: '⚠️',
          bgGradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          borderColor: '#fecaca',
          textColor: '#991b1b',
          dismissColor: '#991b1b'
        };
    }
  };

  const config = getErrorConfig();

  return (
    <div className={`error-message ${className}`}>
      <div className="error-content">
        <div className="error-icon">{config.icon}</div>
        <div className="error-text-container">
          <p className="error-text">{error}</p>
          {showRetry && onRetry && (
            <div className="error-actions">
              <RetryButton 
                onRetry={onRetry}
                isLoading={isRetrying}
                className="error-retry-button"
              />
            </div>
          )}
        </div>
        {showDismiss && onDismiss && (
          <button 
            className="error-dismiss-button"
            onClick={onDismiss}
            aria-label="Close error message"
            type="button"
          >
            ✕
          </button>
        )}
      </div>
      
      <style jsx>{`
        .error-message {
          background: ${config.bgGradient};
          border: 1px solid ${config.borderColor};
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .error-content {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }
        
        .error-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
          margin-top: 0.125rem;
        }
        
        .error-text-container {
          flex: 1;
          min-width: 0;
        }
        
        .error-text {
          margin: 0 0 1rem 0;
          color: ${config.textColor};
          font-weight: 500;
          line-height: 1.5;
          word-wrap: break-word;
          hyphens: auto;
        }
        
        .error-text:last-child {
          margin-bottom: 0;
        }
        
        .error-actions {
          margin-top: 0.75rem;
        }
        
        .error-retry-button {
          font-size: 0.8125rem;
          padding: 0.5rem 1rem;
        }
        
        .error-dismiss-button {
          background: none;
          border: none;
          color: ${config.dismissColor};
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          font-size: 1rem;
          line-height: 1;
          flex-shrink: 0;
          transition: background-color 0.2s ease;
          margin-top: -0.125rem;
        }
        
        .error-dismiss-button:hover {
          background: rgba(153, 27, 27, 0.1);
        }
        
        .error-dismiss-button:focus {
          outline: 2px solid ${config.dismissColor};
          outline-offset: 2px;
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
          .error-message {
            padding: 0.875rem;
            border-radius: 6px;
          }
          
          .error-content {
            gap: 0.625rem;
          }
          
          .error-icon {
            font-size: 1.125rem;
          }
          
          .error-text {
            font-size: 0.9rem;
          }
          
          .error-dismiss-button {
            font-size: 0.9rem;
            padding: 0.1875rem;
          }
        }
        
        @media (max-width: 480px) {
          .error-message {
            padding: 0.75rem;
          }
          
          .error-content {
            gap: 0.5rem;
          }
          
          .error-text {
            font-size: 0.875rem;
          }
        }
      `}</style>
    </div>
  );
}