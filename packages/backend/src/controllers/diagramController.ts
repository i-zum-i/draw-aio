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
      // Check if API key is available
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      
      // Create LLM service instance
      this.llmService = new LLMService();
      
      // Verify the service was created
      if (!this.llmService) {
        throw new Error('LLM service instance creation failed');
      }
    } catch (error) {
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
      // Ensure LLM service is initialized
      if (!this.llmService) {
        try {
          this.initialize();
        } catch (initError) {
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

      // Generate Draw.io XML using LLM
      const drawioXML = await this.llmService.generateDrawioXML(sanitizedPrompt);

      // Save .drawio file
      const drawioFileId = await fileService.saveDrawioFile(drawioXML);
      const downloadUrl = fileService.generateTempUrl(drawioFileId, req.protocol + '://' + req.get('host'));

      // Generate PNG image
      const drawioFilePath = fileService.getFilePath(drawioFileId);
      const imageResult = await imageService.generatePNGWithFallback(drawioFilePath);
      
      let imageUrl: string | undefined;
      let warningMessage: string | undefined;
      
      if (imageResult.success && imageResult.imageFileId) {
        imageUrl = fileService.generateTempUrl(imageResult.imageFileId, req.protocol + '://' + req.get('host'));
      } else {
        warningMessage = `Diagram generated successfully, but preview image generation failed: ${imageResult.error}`;
      }

      const response: DiagramResponse = {
        status: 'success',
        message: warningMessage || 'Diagram generated successfully',
        downloadUrl,
        imageUrl,
      };

      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        res.status(200).json(response);
      }
    } catch (error) {
      // Don't send response if headers already sent
      if (res.headersSent) {
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
          message: 'AI service configuration error. Please contact administrator',
          code: 'LLM_CONFIG_ERROR',
        };
        res.status(500).json(errorResponse);
        return;
      }
      
      // Handle unknown errors
      const errorResponse: ErrorResponse = {
        status: 'error',
        message: 'Internal error occurred during diagram generation',
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