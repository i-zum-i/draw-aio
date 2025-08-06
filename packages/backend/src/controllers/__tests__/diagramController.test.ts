import { Request, Response } from 'express';
import { DiagramController } from '../diagramController';
import { LLMService, LLMError, LLMErrorCode } from '../../services/llmService';
import { fileService } from '../../services/fileService';
import { imageService } from '../../services/imageService';

// Mock the services
jest.mock('../../services/llmService', () => {
  return {
    LLMService: jest.fn(),
    LLMError: jest.requireActual('../../services/llmService').LLMError,
    LLMErrorCode: jest.requireActual('../../services/llmService').LLMErrorCode,
  };
});

jest.mock('../../services/fileService', () => ({
  fileService: {
    saveDrawioFile: jest.fn(),
    generateTempUrl: jest.fn(),
    getFilePath: jest.fn(),
  },
}));

jest.mock('../../services/imageService', () => ({
  imageService: {
    generatePNGWithFallback: jest.fn(),
  },
}));

const mockFileService = fileService as jest.Mocked<typeof fileService>;
const mockImageService = imageService as jest.Mocked<typeof imageService>;

describe('DiagramController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockLLMService: jest.Mocked<LLMService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request and response
    mockRequest = {
      body: {
        prompt: 'テスト図を作成してください',
      },
      protocol: 'http',
      get: jest.fn().mockReturnValue('localhost:3001'),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Mock LLMService
    mockLLMService = {
      generateDrawioXML: jest.fn(),
    } as any;

    // Mock the LLMService constructor and static methods
    const MockedLLMService = LLMService as jest.MockedClass<typeof LLMService>;
    MockedLLMService.mockImplementation(() => mockLLMService);
    
    // Reset the static llmService instance for each test
    (DiagramController as any).llmService = null;

    // Setup default mock implementations
    mockFileService.saveDrawioFile.mockResolvedValue('test-drawio-id');
    mockFileService.generateTempUrl.mockReturnValue('http://localhost:3001/api/files/test-file-id');
    mockFileService.getFilePath.mockReturnValue('/tmp/test-drawio-id.drawio');
    mockImageService.generatePNGWithFallback.mockResolvedValue({
      success: true,
      imageFileId: 'test-png-id',
    });
  });

  describe('generateDiagram', () => {
    it('should handle successful diagram generation with PNG', async () => {
      const mockXML = '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
      mockLLMService.generateDrawioXML.mockResolvedValue(mockXML);

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockLLMService.generateDrawioXML).toHaveBeenCalledWith('テスト図を作成してください');
      expect(mockFileService.saveDrawioFile).toHaveBeenCalledWith(mockXML);
      expect(mockFileService.getFilePath).toHaveBeenCalledWith('test-drawio-id');
      expect(mockImageService.generatePNGWithFallback).toHaveBeenCalledWith('/tmp/test-drawio-id.drawio');
      
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        message: '図を正常に生成しました',
        downloadUrl: 'http://localhost:3001/api/files/test-file-id',
        imageUrl: 'http://localhost:3001/api/files/test-file-id',
      });
    });

    it('should handle successful diagram generation with PNG failure', async () => {
      const mockXML = '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
      mockLLMService.generateDrawioXML.mockResolvedValue(mockXML);
      mockImageService.generatePNGWithFallback.mockResolvedValue({
        success: false,
        error: 'Draw.io CLI is not installed',
      });

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        message: expect.stringContaining('プレビュー画像の生成に失敗しました'),
        downloadUrl: 'http://localhost:3001/api/files/test-file-id',
        imageUrl: undefined,
      });
    });

    it('should handle file service errors', async () => {
      const mockXML = '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
      mockLLMService.generateDrawioXML.mockResolvedValue(mockXML);
      mockFileService.saveDrawioFile.mockRejectedValue(new Error('File save failed'));

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: '図生成中に内部エラーが発生しました',
        code: 'INTERNAL_ERROR',
      });
    });

    it('should handle LLM rate limit errors with appropriate status code', async () => {
      const rateLimitError = new LLMError(
        'AI サービスのレート制限に達しました',
        LLMErrorCode.RATE_LIMIT_ERROR
      );
      mockLLMService.generateDrawioXML.mockRejectedValue(rateLimitError);

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'AI サービスのレート制限に達しました',
        code: LLMErrorCode.RATE_LIMIT_ERROR,
      });
    });

    it('should handle LLM quota exceeded errors with appropriate status code', async () => {
      const quotaError = new LLMError(
        'AI サービスの利用制限に達しました',
        LLMErrorCode.QUOTA_EXCEEDED
      );
      mockLLMService.generateDrawioXML.mockRejectedValue(quotaError);

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(402);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'AI サービスの利用制限に達しました',
        code: LLMErrorCode.QUOTA_EXCEEDED,
      });
    });

    it('should handle LLM connection errors with appropriate status code', async () => {
      const connectionError = new LLMError(
        'AI サービスに接続できません',
        LLMErrorCode.CONNECTION_ERROR
      );
      mockLLMService.generateDrawioXML.mockRejectedValue(connectionError);

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'AI サービスに接続できません',
        code: LLMErrorCode.CONNECTION_ERROR,
      });
    });

    it('should handle LLM authentication errors with appropriate status code', async () => {
      const authError = new LLMError(
        'AI サービスの認証に失敗しました',
        LLMErrorCode.API_KEY_MISSING
      );
      mockLLMService.generateDrawioXML.mockRejectedValue(authError);

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'AI サービスの認証に失敗しました',
        code: LLMErrorCode.API_KEY_MISSING,
      });
    });

    it('should handle LLM invalid response errors with appropriate status code', async () => {
      const invalidResponseError = new LLMError(
        'AI が有効な図を生成できませんでした',
        LLMErrorCode.INVALID_RESPONSE
      );
      mockLLMService.generateDrawioXML.mockRejectedValue(invalidResponseError);

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'AI が有効な図を生成できませんでした',
        code: LLMErrorCode.INVALID_RESPONSE,
      });
    });

    it('should handle LLM invalid XML errors with appropriate status code', async () => {
      const invalidXMLError = new LLMError(
        '生成されたXMLが無効です',
        LLMErrorCode.INVALID_XML
      );
      mockLLMService.generateDrawioXML.mockRejectedValue(invalidXMLError);

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: '生成されたXMLが無効です',
        code: LLMErrorCode.INVALID_XML,
      });
    });

    it('should handle LLM timeout errors with appropriate status code', async () => {
      const timeoutError = new LLMError(
        'AI サービスの応答がタイムアウトしました',
        LLMErrorCode.TIMEOUT_ERROR
      );
      mockLLMService.generateDrawioXML.mockRejectedValue(timeoutError);

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'AI サービスの応答がタイムアウトしました',
        code: LLMErrorCode.TIMEOUT_ERROR,
      });
    });

    it('should handle initialization errors', async () => {
      const initError = new Error('ANTHROPIC_API_KEY environment variable is required');
      mockLLMService.generateDrawioXML.mockRejectedValue(initError);

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'AI サービスの設定に問題があります。管理者にお問い合わせください',
        code: 'LLM_CONFIG_ERROR',
      });
    });

    it('should handle unknown errors', async () => {
      const unknownError = new Error('Some unexpected error');
      mockLLMService.generateDrawioXML.mockRejectedValue(unknownError);

      await DiagramController.generateDiagram(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: '図生成中に内部エラーが発生しました',
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('getHttpStatusForLLMError', () => {
    it('should return correct status codes for different error types', () => {
      // Access the private method through any casting for testing
      const controller = DiagramController as any;

      expect(controller.getHttpStatusForLLMError(LLMErrorCode.RATE_LIMIT_ERROR)).toBe(429);
      expect(controller.getHttpStatusForLLMError(LLMErrorCode.QUOTA_EXCEEDED)).toBe(402);
      expect(controller.getHttpStatusForLLMError(LLMErrorCode.API_KEY_MISSING)).toBe(401);
      expect(controller.getHttpStatusForLLMError(LLMErrorCode.INVALID_RESPONSE)).toBe(422);
      expect(controller.getHttpStatusForLLMError(LLMErrorCode.INVALID_XML)).toBe(422);
      expect(controller.getHttpStatusForLLMError(LLMErrorCode.CONNECTION_ERROR)).toBe(503);
      expect(controller.getHttpStatusForLLMError(LLMErrorCode.TIMEOUT_ERROR)).toBe(503);
      expect(controller.getHttpStatusForLLMError(LLMErrorCode.UNKNOWN_ERROR)).toBe(500);
    });
  });
});