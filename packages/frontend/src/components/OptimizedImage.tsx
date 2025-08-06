'use client';

import React, { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  onLoadStart?: () => void;
  style?: React.CSSProperties;
}

export default function OptimizedImage({
  src,
  alt,
  className = '',
  onLoad,
  onError,
  onLoadStart,
  style = {},
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
    onLoadStart?.();
  };

  // Reset states when src changes
  React.useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  // Monitor image element after it's created
  useEffect(() => {
    const img = imgRef.current;
    if (img) {
      // Check if image is already loaded
      if (img.complete && img.naturalWidth > 0) {
        handleLoad();
      }
    }
  }, [src]);

  if (hasError) {
    return (
      <div className={`image-error ${className}`} style={style}>
        <div className="error-content">
          <div className="error-icon">🖼️</div>
          <p>Failed to load image</p>
        </div>
        <style jsx>{`
          .image-error {
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            border-radius: 8px;
            min-height: 200px;
            color: #6c757d;
          }
          
          .error-content {
            text-align: center;
          }
          
          .error-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
            opacity: 0.7;
          }
          
          .error-content p {
            margin: 0;
            font-size: 0.875rem;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`optimized-image-container ${className}`} style={style}>
      {isLoading && (
        <div className="loading-placeholder">
          <div className="loading-spinner"></div>
          <p>Loading image...</p>
        </div>
      )}
      
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`optimized-image ${isLoading ? 'loading' : 'loaded'}`}
        onLoad={handleLoad}
        onError={handleError}
        onLoadStart={handleLoadStart}
        loading="eager"
        decoding="async"
        style={{
          display: isLoading ? 'none' : 'block',
        }}
      />
      
      <style jsx>{`
        .optimized-image-container {
          position: relative;
          display: inline-block;
          max-width: 100%;
        }
        
        .loading-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 2rem;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          min-height: 200px;
          color: #6c757d;
        }
        
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e9ecef;
          border-top: 3px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-placeholder p {
          margin: 0;
          font-size: 0.875rem;
        }
        
        .optimized-image {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: opacity 0.3s ease;
        }
        
        .optimized-image.loading {
          opacity: 0;
        }
        
        .optimized-image.loaded {
          opacity: 1;
        }
        
        /* Responsive optimizations */
        @media (max-width: 768px) {
          .loading-placeholder {
            padding: 1.5rem;
            min-height: 150px;
          }
          
          .loading-spinner {
            width: 24px;
            height: 24px;
            border-width: 2px;
          }
        }
      `}</style>
    </div>
  );
}