import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MainPage from '../components/MainPage';
import { DiagramResponse } from '../types';

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

describe('Frontend-Backend Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('API Communication Flow', () => {
    it('should successfully submit form and display results', async () => {
      const user = userEvent.setup();
      
      // Mock successful API response
      const mockResponse: DiagramResponse = {
        status: 'success',
        imageUrl: '/api/files/test-image-123.png',
        downloadUrl: '/api/files/test-diagram-123.drawio'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<MainPage />);

      // Find and fill the input textarea
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'テストフローチャートを作成してください');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Verify loading state
      expect(screen.getByText(/生成中/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Wait for API call to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/generate-diagram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: 'テストフローチャートを作成してください' }),
        });
      });

      // Verify results are displayed
      await waitFor(() => {
        expect(screen.getByText(/生成された図/i)).toBeInTheDocument();
      });

      // Verify download link is present
      expect(screen.getByText(/ダウンロード/i)).toBeInTheDocument();
    });

    it('should handle API error responses', async () => {
      const user = userEvent.setup();
      
      // Mock error API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          status: 'error',
          message: 'AI処理中にエラーが発生しました。'
        }),
      });

      render(<MainPage />);

      // Fill and submit form
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'エラーテスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Wait for error to be displayed
      await waitFor(() => {
        expect(screen.getByText(/AI処理中にエラーが発生しました/i)).toBeInTheDocument();
      });

      // Verify retry button is available
      expect(screen.getByText(/再試行/i)).toBeInTheDocument();
    });

    it('should handle network errors', async () => {
      const user = userEvent.setup();
      
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<MainPage />);

      // Fill and submit form
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'ネットワークエラーテスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Wait for error to be displayed
      await waitFor(() => {
        expect(screen.getByText(/ネットワークエラー/i)).toBeInTheDocument();
      });
    });

    it('should retry failed requests', async () => {
      const user = userEvent.setup();
      
      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'success',
            imageUrl: '/api/files/retry-test.png',
            downloadUrl: '/api/files/retry-test.drawio'
          }),
        });

      render(<MainPage />);

      // Fill and submit form
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'リトライテスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Wait for error and retry button
      await waitFor(() => {
        expect(screen.getByText(/再試行/i)).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByText(/再試行/i);
      await user.click(retryButton);

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText(/生成された図/i)).toBeInTheDocument();
      });

      // Verify both API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Input Validation Integration', () => {
    it('should validate empty input', async () => {
      const user = userEvent.setup();
      
      render(<MainPage />);

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Verify validation error
      expect(screen.getByText(/図の説明を入力してください/i)).toBeInTheDocument();
      
      // Verify no API call was made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should validate input length', async () => {
      const user = userEvent.setup();
      
      render(<MainPage />);

      // Fill with overly long text
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      const longText = 'a'.repeat(10001);
      await user.type(textarea, longText);

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Verify validation error
      expect(screen.getByText(/長すぎます/i)).toBeInTheDocument();
      
      // Verify no API call was made
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should clear validation errors when input changes', async () => {
      const user = userEvent.setup();
      
      render(<MainPage />);

      // Try to submit empty form to trigger validation error
      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Verify validation error appears
      expect(screen.getByText(/図の説明を入力してください/i)).toBeInTheDocument();

      // Type in textarea
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'テスト入力');

      // Verify validation error is cleared
      expect(screen.queryByText(/図の説明を入力してください/i)).not.toBeInTheDocument();
    });
  });

  describe('File Download Integration', () => {
    it('should handle file download clicks', async () => {
      const user = userEvent.setup();
      
      // Mock successful API response with download URL
      const mockResponse: DiagramResponse = {
        status: 'success',
        imageUrl: '/api/files/test-image-123.png',
        downloadUrl: '/api/files/test-diagram-123.drawio'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<MainPage />);

      // Submit form
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'ダウンロードテスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/ダウンロード/i)).toBeInTheDocument();
      });

      // Verify download link has correct href
      const downloadLink = screen.getByRole('link', { name: /ダウンロード/i });
      expect(downloadLink).toHaveAttribute('href', '/api/files/test-diagram-123.drawio');
      expect(downloadLink).toHaveAttribute('download');
    });
  });

  describe('Loading States Integration', () => {
    it('should show loading state during API call', async () => {
      const user = userEvent.setup();
      
      // Mock delayed API response
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(delayedPromise);

      render(<MainPage />);

      // Submit form
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'ローディングテスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Verify loading state
      expect(screen.getByText(/生成中/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/loading-test.png',
          downloadUrl: '/api/files/loading-test.drawio'
        }),
      });

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/生成中/i)).not.toBeInTheDocument();
      });

      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Japanese Input Integration', () => {
    it('should handle Japanese text input correctly', async () => {
      const user = userEvent.setup();
      
      const mockResponse: DiagramResponse = {
        status: 'success',
        imageUrl: '/api/files/japanese-test.png',
        downloadUrl: '/api/files/japanese-test.drawio'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<MainPage />);

      // Input Japanese text
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      const japaneseText = 'ユーザー登録からログインまでのフローチャートを作成してください。データベースとの連携も含めてください。';
      await user.type(textarea, japaneseText);

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Verify API was called with Japanese text
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/generate-diagram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: japaneseText }),
        });
      });

      // Verify success
      await waitFor(() => {
        expect(screen.getByText(/生成された図/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery Integration', () => {
    it('should allow new requests after error', async () => {
      const user = userEvent.setup();
      
      // First request fails
      mockFetch.mockRejectedValueOnce(new Error('First request failed'));

      render(<MainPage />);

      // Submit first request
      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, '最初のリクエスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/エラー/i)).toBeInTheDocument();
      });

      // Clear input and try again with successful response
      await user.clear(textarea);
      await user.type(textarea, '二回目のリクエスト');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/second-request.png',
          downloadUrl: '/api/files/second-request.drawio'
        }),
      });

      await user.click(submitButton);

      // Verify success
      await waitFor(() => {
        expect(screen.getByText(/生成された図/i)).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});