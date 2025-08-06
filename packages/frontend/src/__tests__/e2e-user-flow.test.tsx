import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MainPage from '../components/MainPage';

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock network status hook
jest.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: true,
    isSlowConnection: false,
    connectionType: 'wifi'
  }),
  getTimeoutForConnection: () => 30000
}));

describe('End-to-End User Flow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Complete Success Flow', () => {
    it('should complete full user journey from input to download', async () => {
      const user = userEvent.setup();
      
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/complete-flow-test.png',
          downloadUrl: '/api/files/complete-flow-test.drawio'
        }),
      });

      render(<MainPage />);

      // Step 1: User sees the initial interface
      expect(screen.getByText(/AI Diagram Generator/i)).toBeInTheDocument();
      expect(screen.getByText(/自然言語の説明からDraw.io形式の図を自動生成します/i)).toBeInTheDocument();
      
      // Step 2: User enters input
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      const testInput = 'ユーザー登録からログインまでの完全なフローチャートを作成してください';
      await user.type(textarea, testInput);
      
      // Verify input is displayed
      expect(textarea).toHaveValue(testInput);
      expect(screen.getByText(`${testInput.length}/10,000文字`)).toBeInTheDocument();

      // Step 3: User submits the form
      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      expect(submitButton).not.toBeDisabled();
      await user.click(submitButton);

      // Step 4: Loading state is shown
      expect(screen.getByText(/生成中/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
      expect(textarea).toBeDisabled();

      // Step 5: API call is made with correct data
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/generate-diagram',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: testInput })
          })
        );
      });

      // Step 6: Results are displayed
      await waitFor(() => {
        expect(screen.getByText(/生成された図/i)).toBeInTheDocument();
      });

      // Step 7: Image is displayed
      const image = screen.getByAltText(/Generated diagram preview/i);
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', '/api/files/complete-flow-test.png');

      // Step 8: Download link is available
      const downloadLink = screen.getByRole('link', { name: /drawioファイルをダウンロード/i });
      expect(downloadLink).toBeInTheDocument();
      expect(downloadLink).toHaveAttribute('href', '/api/files/complete-flow-test.drawio');
      expect(downloadLink).toHaveAttribute('download');

      // Step 9: User can make another request
      expect(submitButton).not.toBeDisabled();
      expect(textarea).not.toBeDisabled();
    });
  });

  describe('Japanese Input Flow', () => {
    it('should handle Japanese text input correctly throughout the flow', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/japanese-flow-test.png',
          downloadUrl: '/api/files/japanese-flow-test.drawio'
        }),
      });

      render(<MainPage />);

      // Test with complex Japanese input
      const japaneseInput = 'データベース設計からWebアプリケーション開発までの工程を示すフローチャートを作成してください。要件定義、設計、実装、テスト、デプロイメントの各段階を含めてください。';
      
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      
      // Use fireEvent for Japanese text to avoid timing issues
      fireEvent.change(textarea, { target: { value: japaneseInput } });
      
      expect(textarea).toHaveValue(japaneseInput);
      
      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Verify API call with Japanese text
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/generate-diagram',
          expect.objectContaining({
            body: JSON.stringify({ prompt: japaneseInput })
          })
        );
      });

      // Verify results display
      await waitFor(() => {
        expect(screen.getByText(/生成された図/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery Flow', () => {
    it('should allow user to recover from errors and retry', async () => {
      const user = userEvent.setup();
      
      // First request fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<MainPage />);

      // Initial input and submission
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'エラー回復テスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/予期しないエラーが発生しました/i)).toBeInTheDocument();
      });

      // User can retry with the same input
      const retryButton = screen.getByRole('button', { name: /再試行/i });
      expect(retryButton).toBeInTheDocument();

      // Mock successful retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/retry-success.png',
          downloadUrl: '/api/files/retry-success.drawio'
        }),
      });

      await user.click(retryButton);

      // Verify success after retry
      await waitFor(() => {
        expect(screen.getByText(/生成された図/i)).toBeInTheDocument();
      });

      // Verify API was called twice
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Input Validation Flow', () => {
    it('should guide user through input validation errors', async () => {
      const user = userEvent.setup();
      
      render(<MainPage />);

      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      const submitButton = screen.getByRole('button', { name: /図を作成/i });

      // Test empty input validation
      await user.click(submitButton);
      expect(screen.getByText(/図の説明を入力してください/i)).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();

      // User corrects the input
      await user.type(textarea, '有効な入力');
      
      // Validation error should clear (check for error message specifically)
      await waitFor(() => {
        const errorMessages = screen.queryAllByText(/図の説明を入力してください/i);
        // Should only have the label, not the error message
        expect(errorMessages.length).toBe(1); // Only the label should remain
      });

      // Test length validation
      await user.clear(textarea);
      const longInput = 'a'.repeat(10001);
      fireEvent.change(textarea, { target: { value: longInput } });

      await user.click(submitButton);
      expect(screen.getByText(/長すぎます/i)).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();

      // User corrects to valid length
      await user.clear(textarea);
      await user.type(textarea, '適切な長さの入力');

      // Mock successful submission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/validation-success.png',
          downloadUrl: '/api/files/validation-success.drawio'
        }),
      });

      await user.click(submitButton);

      // Should now succeed
      await waitFor(() => {
        expect(screen.getByText(/生成された図/i)).toBeInTheDocument();
      });
    });
  });

  describe('File Download Flow', () => {
    it('should provide working download functionality', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/download-test.png',
          downloadUrl: '/api/files/download-test.drawio'
        }),
      });

      render(<MainPage />);

      // Generate a diagram
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'ダウンロードテスト用の図');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/ファイルダウンロード/i)).toBeInTheDocument();
      });

      // Verify download link properties
      const downloadLink = screen.getByRole('link', { name: /drawioファイルをダウンロード/i });
      expect(downloadLink).toHaveAttribute('href', '/api/files/download-test.drawio');
      expect(downloadLink).toHaveAttribute('download', '');
      expect(downloadLink).toHaveAttribute('aria-label', '.drawioファイルをダウンロード');

      // Verify external link to Draw.io
      const externalLink = screen.getByRole('link', { name: /Draw.io/i });
      expect(externalLink).toHaveAttribute('href', 'https://app.diagrams.net/');
      expect(externalLink).toHaveAttribute('target', '_blank');
      expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Multiple Request Flow', () => {
    it('should handle multiple consecutive requests correctly', async () => {
      const user = userEvent.setup();
      
      render(<MainPage />);

      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      const submitButton = screen.getByRole('button', { name: /図を作成/i });

      // First request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/first-request.png',
          downloadUrl: '/api/files/first-request.drawio'
        }),
      });

      await user.type(textarea, '最初のリクエスト');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/生成された図/i)).toBeInTheDocument();
      });

      // Second request - clear and enter new input
      await user.clear(textarea);
      await user.type(textarea, '二番目のリクエスト');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/second-request.png',
          downloadUrl: '/api/files/second-request.drawio'
        }),
      });

      await user.click(submitButton);

      // Verify second request results
      await waitFor(() => {
        const image = screen.getByAltText(/Generated diagram preview/i);
        expect(image).toHaveAttribute('src', '/api/files/second-request.png');
      });

      await waitFor(() => {
        const downloadLink = screen.getByRole('link', { name: /drawioファイルをダウンロード/i });
        expect(downloadLink).toHaveAttribute('href', '/api/files/second-request.drawio');
      });

      // Verify both API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});