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
    // Set initial state
    setIsOnline(navigator.onLine);

    // If Connection API is available
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
 * Adjust timeout based on network status
 */
export function getTimeoutForConnection(connectionType: string): number {
  switch (connectionType) {
    case 'slow-2g':
      return 120000; // 120 seconds (2 minutes)
    case '2g':
      return 90000; // 90 seconds
    case '3g':
      return 75000; // 75 seconds
    case '4g':
    case '5g':
      return 60000; // 60 seconds
    default:
      return 60000; // Default 60 seconds
  }
}

/**
 * Test network connection status
 */
export async function testNetworkConnection(): Promise<boolean> {
  try {
    // Test network status with a small request
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-cache'
    });
    return response.ok;
  } catch {
    return false;
  }
}