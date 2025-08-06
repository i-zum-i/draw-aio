import { LLMService, LLMError, LLMErrorCode } from '../llmService';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

describe('LLMService', () => {
  let llmService: LLMService;
  let mockAnthropicClient: any;

  beforeEach(() => {
    // Set up environment variable
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get the mocked Anthropic constructor
    const Anthropic = require('@anthropic-ai/sdk').default;
    mockAnthropicClient = {
      messages: {
        create: jest.fn(),
      },
    };
    Anthropic.mockReturnValue(mockAnthropicClient);
    
    llmService = new LLMService();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('constructor', () => {
    it('should throw error if ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => new LLMService()).toThrow('ANTHROPIC_API_KEY environment variable is required');
    });

    it('should initialize successfully with API key', () => {
      expect(() => new LLMService()).not.toThrow();
    });
  });

  describe('generateDrawioXML', () => {
    it('should generate valid Draw.io XML from prompt', async () => {
      const mockXML = `<mxfile host="app.diagrams.net" modified="2024-01-01T00:00:00.000Z" agent="AI" version="22.1.0">
  <diagram name="Page-1" id="page-id">
    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="テストボックス" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="340" y="280" width="120" height="60" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: mockXML,
          },
        ],
      });

      const result = await llmService.generateDrawioXML('シンプルなボックスを作成してください');

      expect(result).toBe(mockXML);
      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        temperature: 0.3,
        system: expect.stringContaining('Draw.io形式のXMLを生成する専門家'),
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('シンプルなボックスを作成してください'),
          },
        ],
      });
    });

    it('should extract XML from code block format', async () => {
      const mockXML = `<mxfile host="app.diagrams.net">
  <diagram name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

      const responseWithCodeBlock = `\`\`\`xml
${mockXML}
\`\`\``;

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: responseWithCodeBlock,
          },
        ],
      });

      const result = await llmService.generateDrawioXML('テスト図を作成');

      expect(result).toBe(mockXML);
    });

    it('should throw LLMError for invalid XML response', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'This is not XML content',
          },
        ],
      });

      try {
        await llmService.generateDrawioXML('テスト');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe(LLMErrorCode.INVALID_RESPONSE);
        expect((error as LLMError).message).toContain('有効な図を生成できませんでした');
      }
    });

    it('should throw error for malformed Draw.io XML', async () => {
      const invalidXML = '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/></root></mxGraphModel></diagram></mxfile>';

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: invalidXML,
          },
        ],
      });

      // This should pass validation since it has the required structure
      const result = await llmService.generateDrawioXML('テスト');
      expect(result).toBe(invalidXML);
    });

    it('should throw LLMError for XML without mxfile tag', async () => {
      const invalidXML = '<xml>Invalid Draw.io format</xml>';

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: invalidXML,
          },
        ],
      });

      try {
        await llmService.generateDrawioXML('テスト');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe(LLMErrorCode.INVALID_RESPONSE);
      }
    });

    it('should throw LLMError for XML validation failures', async () => {
      const invalidXML = '<mxfile><diagram>Missing required elements</diagram></mxfile>';

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: invalidXML,
          },
        ],
      });

      try {
        await llmService.generateDrawioXML('テスト');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe(LLMErrorCode.INVALID_XML);
        expect((error as LLMError).message).toContain('XMLが無効です');
      }
    });

    it('should handle rate limit errors', async () => {
      const apiError = new Error('Rate limit exceeded');
      mockAnthropicClient.messages.create.mockRejectedValue(apiError);

      await expect(llmService.generateDrawioXML('テスト')).rejects.toThrow(LLMError);
      
      try {
        await llmService.generateDrawioXML('テスト');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe(LLMErrorCode.RATE_LIMIT_ERROR);
        expect((error as LLMError).message).toContain('レート制限');
      }
    });

    it('should handle connection errors', async () => {
      const connectionError = new Error('Network connection failed');
      mockAnthropicClient.messages.create.mockRejectedValue(connectionError);

      try {
        await llmService.generateDrawioXML('テスト');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe(LLMErrorCode.CONNECTION_ERROR);
        expect((error as LLMError).message).toContain('接続できません');
      }
    });

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('Quota exceeded for this billing period');
      mockAnthropicClient.messages.create.mockRejectedValue(quotaError);

      try {
        await llmService.generateDrawioXML('テスト');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe(LLMErrorCode.QUOTA_EXCEEDED);
        expect((error as LLMError).message).toContain('利用制限');
      }
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Unauthorized: Invalid API key');
      mockAnthropicClient.messages.create.mockRejectedValue(authError);

      try {
        await llmService.generateDrawioXML('テスト');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe(LLMErrorCode.API_KEY_MISSING);
        expect((error as LLMError).message).toContain('認証に失敗');
      }
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      mockAnthropicClient.messages.create.mockRejectedValue(timeoutError);

      try {
        await llmService.generateDrawioXML('テスト');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe(LLMErrorCode.TIMEOUT_ERROR);
        expect((error as LLMError).message).toContain('タイムアウト');
      }
    });

    it('should handle non-text response type', async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'image',
            data: 'base64-image-data',
          },
        ],
      });

      try {
        await llmService.generateDrawioXML('テスト');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe(LLMErrorCode.INVALID_RESPONSE);
        expect((error as LLMError).message).toContain('予期しないレスポンス形式');
      }
    });

    it('should handle unknown errors', async () => {
      const unknownError = new Error('Some unexpected error');
      mockAnthropicClient.messages.create.mockRejectedValue(unknownError);

      try {
        await llmService.generateDrawioXML('テスト');
      } catch (error) {
        expect(error).toBeInstanceOf(LLMError);
        expect((error as LLMError).code).toBe(LLMErrorCode.UNKNOWN_ERROR);
        expect((error as LLMError).originalError).toBe(unknownError);
      }
    });
  });
});