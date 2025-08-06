import { Request, Response } from 'express';
import { DiagramResponse, ErrorResponse } from '../types/api';
import { DiagramRequestValidated, sanitizeText } from '../utils/validation';
import { LLMService, LLMError, LLMErrorCode } from '../services/llmService';
import { fileService } from '../services/fileService';
import { imageService } from '../services/imageService';

export class DiagramController {
  private static llmService: LLMService;

  /**
   * Initialize the LLM service
   */
  static initialize(): void {
    try {
      console.log('🔧 Starting LLM service initialization...');
      console.log('🔍 Current DiagramController context:', !!this);
      
      // Check if API key is available
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error('❌ ANTHROPIC_API_KEY environment variable is not set');
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      
      console.log('🔑 API key found, length:', apiKey.length);
      
      // Create LLM service instance
      console.log('🚀 Creating LLM service instance...');
      this.llmService = new LLMService();
      
      // Verify the service was created
      if (!this.llmService) {
        throw new Error('LLM service instance creation failed');
      }
      
      console.log('✅ LLM service initialized successfully');
      console.log('🔍 llmService instance:', !!this.llmService);
    } catch (error) {
      console.error('❌ Failed to initialize LLM service:', error);
      // Ensure llmService is null on failure
      this.llmService = null as any;
      throw error;
    }
  }

  /**
   * Generate diagram from natural language prompt
   * POST /api/generate-diagram
   */
  static async generateDiagram(req: Request, res: Response): Promise<void> {
    try {
      console.log('🎯 Starting generateDiagram method...');
      console.log('🔍 DiagramController context:', !!this);
      console.log('🔍 llmService exists?', !!this.llmService);
      
      // Ensure LLM service is initialized
      if (!this.llmService) {
        console.log('LLM service not initialized, initializing now...');
        try {
          this.initialize();
        } catch (initError) {
          console.error('Failed to initialize LLM service during request:', initError);
          throw initError;
        }
      }

      // Double-check initialization
      if (!this.llmService) {
        throw new Error('LLM service is still undefined after initialization attempt');
      }

      // Request body is already validated by middleware
      const { prompt }: DiagramRequestValidated = req.body;
      
      // Additional sanitization for security
      const sanitizedPrompt = sanitizeText(prompt);
      
      console.log('Received diagram generation request:', {
        originalLength: prompt.length,
        sanitizedLength: sanitizedPrompt.length,
        preview: sanitizedPrompt.substring(0, 100) + (sanitizedPrompt.length > 100 ? '...' : ''),
      });

      // Generate Draw.io XML using LLM
      console.log('Generating Draw.io XML from prompt...');
      const drawioXML = await this.llmService.generateDrawioXML(sanitizedPrompt);
      
      console.log('Successfully generated Draw.io XML:', {
        xmlLength: drawioXML.length,
        preview: drawioXML.substring(0, 200) + (drawioXML.length > 200 ? '...' : ''),
      });

      // Save .drawio file
      console.log('Saving .drawio file...');
      const drawioFileId = await fileService.saveDrawioFile(drawioXML);
      const downloadUrl = fileService.generateTempUrl(drawioFileId, req.protocol + '://' + req.get('host'));
      
      console.log('Successfully saved .drawio file:', {
        fileId: drawioFileId,
        downloadUrl,
      });

      // Generate PNG image
      console.log('Generating PNG image...');
      console.log('🔍 Headers sent before PNG generation:', res.headersSent);
      const drawioFilePath = fileService.getFilePath(drawioFileId);
      const imageResult = await imageService.generatePNGWithFallback(drawioFilePath);
      console.log('🔍 Headers sent after PNG generation:', res.headersSent);
      
      let imageUrl: string | undefined;
      let warningMessage: string | undefined;
      
      if (imageResult.success && imageResult.imageFileId) {
        imageUrl = fileService.generateTempUrl(imageResult.imageFileId, req.protocol + '://' + req.get('host'));
        console.log('Successfully generated PNG image:', {
          imageFileId: imageResult.imageFileId,
          imageUrl,
        });
      } else {
        console.warn('PNG generation failed:', imageResult.error);
        warningMessage = `図は正常に生成されましたが、プレビュー画像の生成に失敗しました: ${imageResult.error}`;
      }

      const response: DiagramResponse = {
        status: 'success',
        message: warningMessage || '図を正常に生成しました',
        downloadUrl,
        imageUrl,
      };

      console.log('📤 Sending success response:', {
        status: response.status,
        message: response.message,
        hasDownloadUrl: !!response.downloadUrl,
        hasImageUrl: !!response.imageUrl,
        headersSent: res.headersSent
      });

      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        res.status(200).json(response);
        console.log('✅ Response sent successfully');
      } else {
        console.error('❌ Cannot send response - headers already sent');
      }
    } catch (error) {
      console.error('Error in generateDiagram:', error);
      
      // Don't send response if headers already sent
      if (res.headersSent) {
        console.error('Cannot send error response - headers already sent');
        return;
      }
      
      // Handle LLM specific errors
      if (error instanceof LLMError) {
        const statusCode = this.getHttpStatusForLLMError(error.code);
        const errorResponse: ErrorResponse = {
          status: 'error',
          message: error.message,
          code: error.code,
        };
        res.status(statusCode).json(errorResponse);
        return;
      }

      // Handle initialization errors
      if (error instanceof Error && (error.message.includes('ANTHROPIC_API_KEY') || error.message.includes('initialize'))) {
        const errorResponse: ErrorResponse = {
          status: 'error',
          message: 'AI サービスの設定に問題があります。管理者にお問い合わせください',
          code: 'LLM_CONFIG_ERROR',
        };
        res.status(500).json(errorResponse);
        return;
      }
      
      // Handle unknown errors
      const errorResponse: ErrorResponse = {
        status: 'error',
        message: '図生成中に内部エラーが発生しました',
        code: 'INTERNAL_ERROR',
      };

      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get appropriate HTTP status code for LLM error
   */
  private static getHttpStatusForLLMError(errorCode: string): number {
    switch (errorCode) {
      case LLMErrorCode.RATE_LIMIT_ERROR:
        return 429; // Too Many Requests
      case LLMErrorCode.QUOTA_EXCEEDED:
        return 402; // Payment Required
      case LLMErrorCode.API_KEY_MISSING:
        return 401; // Unauthorized
      case LLMErrorCode.INVALID_RESPONSE:
      case LLMErrorCode.INVALID_XML:
        return 422; // Unprocessable Entity
      case LLMErrorCode.CONNECTION_ERROR:
      case LLMErrorCode.TIMEOUT_ERROR:
        return 503; // Service Unavailable
      default:
        return 500; // Internal Server Error
    }
  }
}