'use client';

import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [connectionType, setConnectionType] = useState('unknown');

  useEffect(() => {
    // 初期状態を設定
    setIsOnline(navigator.onLine);

    // Connection APIが利用可能な場合
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        setConnectionType(connection.effectiveType || 'unknown');
        setIsSlowConnection(connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');

        const handleConnectionChange = () => {
          setConnectionType(connection.effectiveType || 'unknown');
          setIsSlowConnection(connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');
        };

        connection.addEventListener('change', handleConnectionChange);
        
        return () => {
          connection.removeEventListener('change', handleConnectionChange);
        };
      }
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    isSlowConnection,
    connectionType
  };
}

/**
 * ネットワーク状態に基づいてタイムアウト時間を調整
 */
export function getTimeoutForConnection(connectionType: string): number {
  switch (connectionType) {
    case 'slow-2g':
      return 60000; // 60秒
    case '2g':
      return 45000; // 45秒
    case '3g':
      return 30000; // 30秒
    case '4g':
    case '5g':
      return 20000; // 20秒
    default:
      return 30000; // デフォルト30秒
  }
}

/**
 * ネットワーク状態をテストする
 */
export async function testNetworkConnection(): Promise<boolean> {
  try {
    // 小さなリクエストでネットワーク状態をテスト
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-cache'
    });
    return response.ok;
  } catch {
    return false;
  }
}