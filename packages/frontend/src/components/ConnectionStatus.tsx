'use client';

import React, { useState, useEffect } from 'react';

interface ConnectionStatusProps {
  className?: string;
}

export default function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      // オンラインになったら3秒後に非表示
      setTimeout(() => setShowStatus(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    // 初期状態を設定
    setIsOnline(navigator.onLine);

    // イベントリスナーを追加
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showStatus) return null;

  return (
    <div className={`connection-status ${isOnline ? 'online' : 'offline'} ${className}`}>
      <div className="status-content">
        <div className="status-icon">
          {isOnline ? '🟢' : '🔴'}
        </div>
        <span className="status-text">
          {isOnline ? 'インターネット接続が復旧しました' : 'インターネット接続がありません'}
        </span>
      </div>
      
      <style jsx>{`
        .connection-status {
          position: fixed;
          top: 1rem;
          right: 1rem;
          z-index: 1000;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          animation: slideIn 0.3s ease-out;
          max-width: 300px;
        }
        
        .connection-status.online {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #bbf7d0;
          color: #166534;
        }
        
        .connection-status.offline {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border: 1px solid #fecaca;
          color: #991b1b;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .status-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .status-icon {
          font-size: 1rem;
          flex-shrink: 0;
        }
        
        .status-text {
          font-size: 0.875rem;
          font-weight: 500;
          line-height: 1.4;
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
          .connection-status {
            top: 0.5rem;
            right: 0.5rem;
            left: 0.5rem;
            max-width: none;
            padding: 0.625rem 0.875rem;
          }
          
          .status-text {
            font-size: 0.8125rem;
          }
          
          .status-icon {
            font-size: 0.875rem;
          }
        }
        
        @media (max-width: 480px) {
          .connection-status {
            padding: 0.5rem 0.75rem;
          }
          
          .status-text {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}