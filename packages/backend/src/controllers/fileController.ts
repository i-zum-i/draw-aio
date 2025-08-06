import { Request, Response } from 'express';
import { fileService } from '../services/fileService';
import { ErrorHandler } from '../utils/errorHandler';

export class FileController {
  /**
   * Serve a temporary file by ID
   */
  static async serveFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileId } = req.params;
      
      if (!fileId) {
        res.status(400).json(ErrorHandler.createErrorResponse('File ID is required'));
        return;
      }
      
      const fileInfo = fileService.getFileInfo(fileId);
      if (!fileInfo) {
        res.status(404).json(ErrorHandler.createErrorResponse('File not found'));
        return;
      }
      
      // Check if file has expired
      if (new Date() > fileInfo.expiresAt) {
        res.status(410).json(ErrorHandler.createErrorResponse('File has expired'));
        return;
      }
      
      // Set appropriate headers based on file type
      const contentType = fileInfo.type === 'png' ? 'image/png' : 'application/xml';
      const disposition = fileInfo.type === 'png' ? 'inline' : 'attachment';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${fileInfo.originalName}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
      
      // Add CORS headers for cross-origin requests
      const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      console.log('📁 Serving file:', {
        fileId,
        type: fileInfo.type,
        contentType,
        corsOrigin: allowedOrigin
      });
      
      // Send the file
      res.sendFile(fileInfo.path, (err) => {
        if (err) {
          console.error('Error serving file:', err);
          if (!res.headersSent) {
            res.status(500).json(ErrorHandler.createErrorResponse('Failed to serve file'));
          }
        }
      });
      
    } catch (error) {
      console.error('Error in serveFile:', error);
      res.status(500).json(ErrorHandler.createErrorResponse('Internal server error'));
    }
  }
}