'use client';

import React, { useState, useEffect } from 'react';
import { DiagramResponse } from '../types';
import OptimizedImage from './OptimizedImage';

interface ResultDisplayProps {
  result: DiagramResponse | null;
  error: string | null;
  onErrorDismiss: () => void;
}

export default function ResultDisplay({ result, error, onErrorDismiss }: ResultDisplayProps) {
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [downloadAttempted, setDownloadAttempted] = useState(false);

  const handleImageLoad = () => {
    console.log('🖼️ ResultDisplay: Image loaded successfully');
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    console.error('❌ ResultDisplay: Image load failed');
    setImageLoading(false);
    setImageError(true);
  };

  const handleImageLoadStart = () => {
    console.log('🔄 ResultDisplay: Image loading started');
    setImageLoading(true);
    setImageError(false);
  };

  // Reset image states when result changes
  const resetImageStates = () => {
    setImageLoading(false);
    setImageError(false);
  };

  // Handle download click with user feedback
  const handleDownloadClick = () => {
    setDownloadAttempted(true);
    // The browser will handle the actual download via the anchor tag
    // We just track that the user attempted a download for UI feedback
  };

  // Reset download state when result changes (new diagram generated)
  const resetDownloadState = () => {
    setDownloadAttempted(false);
  };

  // Effect to reset states when result changes
  useEffect(() => {
    if (result) {
      resetDownloadState();
    }
  }, [result?.downloadUrl]); // Reset when downloadUrl changes (new diagram)

  // Debug log image loading states
  useEffect(() => {
    console.log('📊 Image states changed:', {
      imageLoading,
      imageError,
      hasResult: !!result,
      hasImageUrl: !!(result?.imageUrl)
    });
  }, [imageLoading, imageError, result]);

  // Debug log when result changes
  useEffect(() => {
    if (result) {
      console.log('🎯 ResultDisplay received result:', {
        hasImageUrl: !!result.imageUrl,
        imageUrl: result.imageUrl,
        hasDownloadUrl: !!result.downloadUrl,
        downloadUrl: result.downloadUrl,
        message: result.message
      });
    }
  }, [result]);

  return (
    <div className="result-section">
      {result && (
        <div className="result-content">
          {result.imageUrl && (
            <div className="image-section">
              <h3 className="section-title">生成された図</h3>
              <div className="image-container">
                {imageLoading && (
                  <div className="image-loading">
                    <div className="loading-spinner"></div>
                    <p>画像を読み込み中...</p>
                  </div>
                )}
                
                {imageError && (
                  <div className="image-error">
                    <div className="error-icon-large">🖼️</div>
                    <p>画像の読み込みに失敗しました</p>
                    <button 
                      className="retry-image-button"
                      onClick={resetImageStates}
                    >
                      再試行
                    </button>
                  </div>
                )}
                
                <OptimizedImage
                  src={result.imageUrl.replace('http://localhost:3001', '')}
                  alt="Generated diagram preview"
                  className="diagram-image"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  onLoadStart={handleImageLoadStart}
                />
              </div>
            </div>
          )}
          
          {result.downloadUrl && (
            <div className="download-section">
              <h3 className="section-title">ファイルダウンロード</h3>
              <div className="download-container">
                <p className="download-description">
                  Draw.ioで編集可能な形式でダウンロードできます
                </p>
                <div className="download-actions">
                  <a 
                    href={result.downloadUrl.replace('http://localhost:3001', '')} 
                    download
                    className="download-link"
                    aria-label=".drawioファイルをダウンロード"
                    onClick={handleDownloadClick}
                  >
                    <span className="download-icon">📁</span>
                    .drawioファイルをダウンロード
                  </a>
                  {downloadAttempted && (
                    <div className="download-feedback">
                      <span className="feedback-icon">✅</span>
                      <span className="feedback-text">ダウンロードを開始しました</span>
                    </div>
                  )}
                </div>
                <div className="download-info">
                  <p className="info-text">
                    💡 ダウンロードしたファイルは<a href="https://app.diagrams.net/" target="_blank" rel="noopener noreferrer" className="external-link">Draw.io</a>で開いて編集できます
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {result.message && (
            <div className="success-message">
              <div className="success-icon">✅</div>
              <p>{result.message}</p>
            </div>
          )}
        </div>
      )}
      
      {!result && (
        <div className="result-placeholder">
          <div className="placeholder-icon">📊</div>
          <h3>図の生成結果がここに表示されます</h3>
          <p>上のフォームに図の説明を入力して「作成」ボタンを押してください</p>
        </div>
      )}
      
      <style jsx>{`
        .result-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
          min-height: 400px;
          margin-top: 2rem;
        }
        
        .result-placeholder {
          text-align: center;
          color: #6b7280;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        
        .placeholder-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }
        
        .result-placeholder h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          font-weight: 600;
        }
        
        .result-placeholder p {
          margin: 0;
          font-size: 0.95rem;
          opacity: 0.8;
        }
        
        .result-content {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        
        .section-title {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }
        
        .image-section {
          text-align: center;
        }
        
        .image-container {
          position: relative;
          display: inline-block;
          max-width: 100%;
        }
        
        .diagram-image {
          max-width: 100%;
          height: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transition: opacity 0.3s ease;
        }
        
        .diagram-image.loading {
          opacity: 0.5;
        }
        
        .image-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
          color: #6b7280;
        }
        
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e7eb;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .image-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 2rem;
          color: #ef4444;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
        }
        
        .error-icon-large {
          font-size: 2rem;
          opacity: 0.7;
        }
        
        .retry-image-button {
          background: #ef4444;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: background-color 0.2s ease;
        }
        
        .retry-image-button:hover {
          background: #dc2626;
        }
        
        .download-section {
          text-align: center;
        }
        
        .download-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }
        
        .download-description {
          margin: 0;
          color: #6b7280;
          font-size: 0.95rem;
        }
        
        .download-actions {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        
        .download-link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 0.875rem 1.5rem;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.95rem;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
        }
        
        .download-link:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
        }
        
        .download-icon {
          font-size: 1.125rem;
        }
        
        .download-feedback {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f0fdf4;
          color: #166534;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          border: 1px solid #bbf7d0;
          font-size: 0.875rem;
          animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .feedback-icon {
          font-size: 1rem;
        }
        
        .feedback-text {
          font-weight: 500;
        }
        
        .download-info {
          text-align: center;
          padding: 1rem;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          max-width: 400px;
        }
        
        .info-text {
          margin: 0;
          font-size: 0.875rem;
          color: #64748b;
          line-height: 1.5;
        }
        
        .external-link {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
        }
        
        .external-link:hover {
          text-decoration: underline;
        }
        
        .success-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 1rem;
          color: #166534;
        }
        
        .success-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }
        
        .success-message p {
          margin: 0;
          font-weight: 500;
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
          .result-section {
            padding: 1.5rem;
            border-radius: 8px;
          }
          
          .result-content {
            gap: 1.5rem;
          }
          
          .section-title {
            font-size: 1rem;
          }
          
          .download-link {
            padding: 0.75rem 1.25rem;
            font-size: 0.875rem;
          }
          
          .download-info {
            max-width: 100%;
            padding: 0.75rem;
          }
          
          .info-text {
            font-size: 0.8125rem;
          }
          
          .placeholder-icon {
            font-size: 2.5rem;
          }
          
          .result-placeholder h3 {
            font-size: 1.125rem;
          }
          
          .result-placeholder p {
            font-size: 0.875rem;
          }
        }
        
        @media (max-width: 480px) {
          .result-section {
            padding: 1rem;
            margin-top: 1.5rem;
          }
          
          .download-link {
            padding: 0.625rem 1rem;
            font-size: 0.8125rem;
          }
          
          .download-feedback {
            padding: 0.375rem 0.75rem;
            font-size: 0.8125rem;
          }
          
          .download-info {
            padding: 0.625rem;
          }
          
          .info-text {
            font-size: 0.75rem;
          }
          
          .image-loading,
          .image-error {
            padding: 1.5rem;
          }
          
          .placeholder-icon {
            font-size: 2rem;
          }
          
          .result-placeholder {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}