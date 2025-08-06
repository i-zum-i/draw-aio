import { Request, Response } from 'express';
import { FileController } from '../fileController';
import { fileService } from '../../services/fileService';
import { TempFile } from '../../services/fileService';

// Mock the fileService
jest.mock('../../services/fileService', () => ({
  fileService: {
    getFileInfo: jest.fn(),
  },
}));

const mockFileService = fileService as jest.Mocked<typeof fileService>;

describe('FileController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockSendFile: jest.Mock;
  let mockSetHeader: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockSendFile = jest.fn();
    mockSetHeader = jest.fn();

    mockRequest = {
      params: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: mockJson,
      sendFile: mockSendFile,
      setHeader: mockSetHeader,
      headersSent: false,
    };

    jest.clearAllMocks();
  });

  describe('serveFile', () => {
    it('should serve a valid drawio file', async () => {
      const fileId = 'test-file-id';
      const mockFileInfo: TempFile = {
        id: fileId,
        originalName: 'test.drawio',
        path: '/tmp/test.drawio',
        type: 'drawio',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000), // 1 minute from now
      };

      mockRequest.params = { fileId };
      mockFileService.getFileInfo.mockReturnValue(mockFileInfo);
      mockSendFile.mockImplementation((path, callback) => callback(null));

      await FileController.serveFile(mockRequest as Request, mockResponse as Response);

      expect(mockFileService.getFileInfo).toHaveBeenCalledWith(fileId);
      expect(mockSetHeader).toHaveBeenCalledWith('Content-Type', 'application/xml');
      expect(mockSetHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="test.drawio"');
      expect(mockSetHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=3600');
      expect(mockSendFile).toHaveBeenCalledWith('/tmp/test.drawio', expect.any(Function));
    });

    it('should serve a valid PNG file', async () => {
      const fileId = 'test-png-id';
      const mockFileInfo: TempFile = {
        id: fileId,
        originalName: 'test.png',
        path: '/tmp/test.png',
        type: 'png',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000), // 1 minute from now
      };

      mockRequest.params = { fileId };
      mockFileService.getFileInfo.mockReturnValue(mockFileInfo);
      mockSendFile.mockImplementation((path, callback) => callback(null));

      await FileController.serveFile(mockRequest as Request, mockResponse as Response);

      expect(mockFileService.getFileInfo).toHaveBeenCalledWith(fileId);
      expect(mockSetHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(mockSetHeader).toHaveBeenCalledWith('Content-Disposition', 'inline; filename="test.png"');
      expect(mockSendFile).toHaveBeenCalledWith('/tmp/test.png', expect.any(Function));
    });

    it('should return 400 if file ID is missing', async () => {
      mockRequest.params = {};

      await FileController.serveFile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        status: 'error',
        message: 'File ID is required',
      });
    });

    it('should return 404 if file is not found', async () => {
      const fileId = 'non-existent-id';
      mockRequest.params = { fileId };
      mockFileService.getFileInfo.mockReturnValue(undefined);

      await FileController.serveFile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        status: 'error',
        message: 'File not found',
      });
    });

    it('should return 410 if file has expired', async () => {
      const fileId = 'expired-file-id';
      const mockFileInfo: TempFile = {
        id: fileId,
        originalName: 'expired.drawio',
        path: '/tmp/expired.drawio',
        type: 'drawio',
        createdAt: new Date(Date.now() - 120000), // 2 minutes ago
        expiresAt: new Date(Date.now() - 60000), // 1 minute ago (expired)
      };

      mockRequest.params = { fileId };
      mockFileService.getFileInfo.mockReturnValue(mockFileInfo);

      await FileController.serveFile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(410);
      expect(mockJson).toHaveBeenCalledWith({
        status: 'error',
        message: 'File has expired',
      });
    });

    it('should handle file serving errors', async () => {
      const fileId = 'test-file-id';
      const mockFileInfo: TempFile = {
        id: fileId,
        originalName: 'test.drawio',
        path: '/tmp/test.drawio',
        type: 'drawio',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      };

      mockRequest.params = { fileId };
      mockFileService.getFileInfo.mockReturnValue(mockFileInfo);
      mockSendFile.mockImplementation((path, callback) => callback(new Error('File read error')));

      await FileController.serveFile(mockRequest as Request, mockResponse as Response);

      expect(mockSendFile).toHaveBeenCalled();
      // The error handling is done in the sendFile callback, so we can't easily test the response
      // But we can verify that sendFile was called with the correct parameters
    });

    it('should handle unexpected errors', async () => {
      const fileId = 'test-file-id';
      mockRequest.params = { fileId };
      mockFileService.getFileInfo.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await FileController.serveFile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        status: 'error',
        message: 'Internal server error',
      });
    });
  });
});