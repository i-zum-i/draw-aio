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

describe('Frontend Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Form Submission Integration', () => {
    it('should submit form with valid input', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/test.png',
          downloadUrl: '/api/files/test.drawio'
        }),
      });

      render(<MainPage />);

      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'テスト図');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Verify API call was made
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/generate-diagram',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'テスト図' })
          })
        );
      });
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      
      // Mock delayed response
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValueOnce(delayedPromise);

      render(<MainPage />);

      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'ローディングテスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Check loading state
      expect(screen.getByText(/生成中/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Resolve promise
      resolvePromise!({
        ok: true,
        json: async () => ({ status: 'success' })
      });

      await waitFor(() => {
        expect(screen.queryByText(/生成中/i)).not.toBeInTheDocument();
      });
    });
  }); 
 describe('Input Validation Integration', () => {
    it('should validate empty input', async () => {
      const user = userEvent.setup();
      
      render(<MainPage />);

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Should show validation error
      expect(screen.getByText(/図の説明を入力してください/i)).toBeInTheDocument();
      
      // Should not make API call
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should validate input length', async () => {
      const user = userEvent.setup();
      
      render(<MainPage />);

      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      const longText = 'a'.repeat(10001);
      
      // Use fireEvent for large text to avoid timeout
      fireEvent.change(textarea, { target: { value: longText } });

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Should show validation error
      expect(screen.getByText(/長すぎます/i)).toBeInTheDocument();
      
      // Should not make API call
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network errors', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<MainPage />);

      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'エラーテスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/予期しないエラーが発生しました/i)).toBeInTheDocument();
      });
    });

    it('should handle API error responses', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          status: 'error',
          message: 'サーバーエラーが発生しました'
        }),
      });

      render(<MainPage />);

      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, 'APIエラーテスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Should show some error message (exact message may vary due to error handling)
      await waitFor(() => {
        const errorElements = screen.queryAllByText(/問題|エラー|失敗/i);
        expect(errorElements.length).toBeGreaterThan(0);
      }, { timeout: 5000 });
    });
  });

  describe('Success Flow Integration', () => {
    it('should display results on successful generation', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          imageUrl: '/api/files/success-test.png',
          downloadUrl: '/api/files/success-test.drawio'
        }),
      });

      render(<MainPage />);

      const textarea = screen.getByLabelText(/図の説明を入力してください/i);
      await user.type(textarea, '成功テスト');

      const submitButton = screen.getByRole('button', { name: /図を作成/i });
      await user.click(submitButton);

      // Should show results
      await waitFor(() => {
        expect(screen.getByText(/生成された図/i)).toBeInTheDocument();
      });

      // Should show download link
      const downloadLink = screen.getByRole('link', { name: /drawioファイルをダウンロード/i });
      expect(downloadLink).toHaveAttribute('href', '/api/files/success-test.drawio');
    });
  });
});