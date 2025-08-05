import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { apiRouter } from '../routes/api';
import { errorHandler, notFoundHandler } from '../utils/errorHandler';
import fs from 'fs';
import path from 'path';

// Mock the service modules before importing
jest.mock('../services/llmService', () => ({
  LLMService: jest.fn().mockImplementation(() => ({
    generateDrawioXML: jest.fn()
  })),
  LLMError: class LLMError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'LLMError';
    }
  },
  LLMErrorCode: {
    API_KEY_MISSING: 'API_KEY_MISSING',
    CONNECTION_ERROR: 'CONNECTION_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    INVALID_XML: 'INVALID_XML',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  }
}));

jest.mock('../services/imageService', () => ({
  imageService: {
    generatePNG: jest.fn()
  }
}));

jest.mock('../services/fileService', () => ({
  fileService: {
    saveDrawioFile: jest.fn(),
    generateTempUrl: jest.fn(),
    getFilePath: jest.fn(),
    cleanupExpiredFiles: jest.fn()
  }
}));

// Create a test app instance to avoid server startup issues
function createTestApp() {
  const app = express();
  
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'ai-diagram-generator-backend'
    });
  });
  
  // API routes
  app.use('/api', apiRouter);
  
  // Error handling middleware
  app.use(notFoundHandler);
  app.use(errorHandler);
  
  return app;
}

describe('Frontend-Backend Integration Tests', () => {
  let app: express.Application;
  const testTempDir = path.join(__dirname, '../../temp/test');
  
  beforeAll(() => {
    // Create test temp directory
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }
  });

  afterAll(async () => {
    // Clean up test temp directory
    if (fs.existsSync(testTempDir)) {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    }
    
    // Give time for any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    
    // Get the mocked services
    const { imageService } = require('../services/imageService');
    const { fileService } = require('../services/fileService');
    
    // Setup default mock implementations
    (imageService.generatePNG as jest.Mock).mockResolvedValue('/temp/default.png');
    (fileService.saveDrawioFile as jest.Mock).mockResolvedValue('test-file-id');
    (fileService.generateTempUrl as jest.Mock).mockReturnValue('/api/files/test-file-id');
    (fileService.getFilePath as jest.Mock).mockReturnValue('/temp/test-file.drawio');
  });

  describe('API Communication Tests', () => {
    it('should successfully generate diagram with valid input', async () => {
      // Mock successful LLM response
      const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
        <mxfile host="app.diagrams.net">
          <diagram name="Test">
            <mxGraphModel>
              <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
                <mxCell id="2" value="Test Node" style="rounded=1;" vertex="1" parent="1">
                  <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
                </mxCell>
              </root>
            </mxGraphModel>
          </diagram>
        </mxfile>`;
      
      mockGenerateDrawioXML.mockResolvedValue(mockXML);
      mockGeneratePNG.mockResolvedValue('/temp/test-image.png');

      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ prompt: 'テストフローチャートを作成してください' })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'success',
        imageUrl: expect.stringContaining('/api/files/'),
        downloadUrl: expect.stringContaining('/api/files/')
      });

      // Verify LLM service was called with correct prompt
      expect(mockGenerateDrawioXML).toHaveBeenCalledWith(
        'テストフローチャートを作成してください'
      );
    });

    it('should handle empty input validation', async () => {
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ prompt: '' })
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.stringContaining('プロンプト')
      });
    });

    it('should handle oversized input validation', async () => {
      const longPrompt = 'a'.repeat(10001);
      
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ prompt: longPrompt })
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.stringContaining('10,000文字')
      });
    });

    it('should handle missing prompt field', async () => {
      const response = await request(app)
        .post('/api/generate-diagram')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'error'
      });
    });
  });

  describe('File Generation and Serving Flow', () => {
    it('should create and serve .drawio file', async () => {
      const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
        <mxfile host="app.diagrams.net">
          <diagram name="Test">
            <mxGraphModel>
              <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
              </root>
            </mxGraphModel>
          </diagram>
        </mxfile>`;
      
      mockGenerateDrawioXML.mockResolvedValue(mockXML);
      mockGeneratePNG.mockResolvedValue('/temp/test-image.png');

      // Generate diagram
      const generateResponse = await request(app)
        .post('/api/generate-diagram')
        .send({ prompt: 'シンプルな図を作成してください' })
        .expect(200);

      expect(generateResponse.body.downloadUrl).toBeDefined();
      
      // Verify file service methods were called
      expect(mockSaveDrawioFile).toHaveBeenCalledWith(mockXML);
      expect(mockGenerateTempUrl).toHaveBeenCalled();
    });

    it('should handle file not found', async () => {
      const response = await request(app)
        .get('/api/files/nonexistent-file-id')
        .expect(404);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.stringContaining('not found')
      });
    });
  });

  describe('Error Cases Integration', () => {
    it('should handle LLM service failure', async () => {
      mockGenerateDrawioXML.mockRejectedValue(
        new Error('LLM service unavailable')
      );

      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ prompt: 'エラーテスト用の図を作成してください' })
        .expect(500);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.stringContaining('AI処理中にエラー')
      });
    });

    it('should handle PNG generation failure gracefully', async () => {
      const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
        <mxfile host="app.diagrams.net">
          <diagram name="Test">
            <mxGraphModel>
              <root>
                <mxCell id="0"/>
                <mxCell id="1" parent="0"/>
              </root>
            </mxGraphModel>
          </diagram>
        </mxfile>`;
      
      mockGenerateDrawioXML.mockResolvedValue(mockXML);
      mockGeneratePNG.mockRejectedValue(
        new Error('PNG generation failed')
      );

      const response = await request(app)
        .post('/api/generate-diagram')
        .send({ prompt: 'PNG生成エラーテスト' })
        .expect(200);

      // Should still succeed with .drawio file even if PNG fails
      expect(response.body).toMatchObject({
        status: 'success',
        downloadUrl: expect.stringContaining('/api/files/')
      });
      
      // Image URL should be undefined when PNG generation fails
      expect(response.body.imageUrl).toBeUndefined();
    });
  });
});