import fs from 'fs/promises';
import path from 'path';
import { FileService } from '../fileService';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileService', () => {
  let fileService: FileService;
  const testTempDir = './test-temp';

  beforeEach(() => {
    jest.clearAllMocks();
    fileService = new FileService(testTempDir);
  });

  afterEach(async () => {
    await fileService.shutdown();
  });

  describe('saveDrawioFile', () => {
    it('should save a .drawio file and return file ID', async () => {
      const xmlContent = '<mxfile><diagram>test</diagram></mxfile>';
      mockFs.writeFile.mockResolvedValue(undefined);

      const fileId = await fileService.saveDrawioFile(xmlContent);

      expect(fileId).toBeDefined();
      expect(typeof fileId).toBe('string');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${fileId}.drawio`),
        xmlContent,
        'utf8'
      );
    });

    it('should throw error if file write fails', async () => {
      const xmlContent = '<mxfile><diagram>test</diagram></mxfile>';
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(fileService.saveDrawioFile(xmlContent)).rejects.toThrow(
        'Failed to save .drawio file: Write failed'
      );
    });
  });

  describe('savePngFile', () => {
    it('should save a PNG file and return file ID', async () => {
      const pngBuffer = Buffer.from('fake png data');
      mockFs.writeFile.mockResolvedValue(undefined);

      const fileId = await fileService.savePngFile(pngBuffer);

      expect(fileId).toBeDefined();
      expect(typeof fileId).toBe('string');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${fileId}.png`),
        pngBuffer
      );
    });

    it('should throw error if file write fails', async () => {
      const pngBuffer = Buffer.from('fake png data');
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(fileService.savePngFile(pngBuffer)).rejects.toThrow(
        'Failed to save PNG file: Write failed'
      );
    });
  });

  describe('generateTempUrl', () => {
    it('should generate a temporary URL for existing file', async () => {
      const xmlContent = '<mxfile><diagram>test</diagram></mxfile>';
      mockFs.writeFile.mockResolvedValue(undefined);

      const fileId = await fileService.saveDrawioFile(xmlContent);
      const url = fileService.generateTempUrl(fileId);

      expect(url).toBe(`http://localhost:3001/api/files/${fileId}`);
    });

    it('should generate URL with custom base URL', async () => {
      const xmlContent = '<mxfile><diagram>test</diagram></mxfile>';
      mockFs.writeFile.mockResolvedValue(undefined);

      const fileId = await fileService.saveDrawioFile(xmlContent);
      const url = fileService.generateTempUrl(fileId, 'https://example.com');

      expect(url).toBe(`https://example.com/api/files/${fileId}`);
    });

    it('should throw error for non-existent file', () => {
      expect(() => fileService.generateTempUrl('non-existent-id')).toThrow(
        'File with ID non-existent-id not found'
      );
    });
  });

  describe('getFileInfo', () => {
    it('should return file info for existing file', async () => {
      const xmlContent = '<mxfile><diagram>test</diagram></mxfile>';
      mockFs.writeFile.mockResolvedValue(undefined);

      const fileId = await fileService.saveDrawioFile(xmlContent);
      const fileInfo = fileService.getFileInfo(fileId);

      expect(fileInfo).toBeDefined();
      expect(fileInfo?.id).toBe(fileId);
      expect(fileInfo?.type).toBe('drawio');
      expect(fileInfo?.originalName).toBe(`${fileId}.drawio`);
    });

    it('should return undefined for non-existent file', () => {
      const fileInfo = fileService.getFileInfo('non-existent-id');
      expect(fileInfo).toBeUndefined();
    });
  });

  describe('getFilePath', () => {
    it('should return file path for existing file', async () => {
      const xmlContent = '<mxfile><diagram>test</diagram></mxfile>';
      mockFs.writeFile.mockResolvedValue(undefined);

      const fileId = await fileService.saveDrawioFile(xmlContent);
      const filePath = fileService.getFilePath(fileId);

      expect(filePath).toBe(path.join(path.resolve(testTempDir), `${fileId}.drawio`));
    });

    it('should throw error for non-existent file', () => {
      expect(() => fileService.getFilePath('non-existent-id')).toThrow(
        'File with ID non-existent-id not found'
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      const xmlContent = '<mxfile><diagram>test</diagram></mxfile>';
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      const fileId = await fileService.saveDrawioFile(xmlContent);
      await fileService.deleteFile(fileId);

      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining(`${fileId}.drawio`)
      );
      expect(fileService.getFileInfo(fileId)).toBeUndefined();
    });

    it('should handle deletion of non-existent file gracefully', async () => {
      await expect(fileService.deleteFile('non-existent-id')).resolves.not.toThrow();
    });

    it('should handle file system errors gracefully', async () => {
      const xmlContent = '<mxfile><diagram>test</diagram></mxfile>';
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockRejectedValue(new Error('File system error'));

      const fileId = await fileService.saveDrawioFile(xmlContent);
      
      // Should not throw, but should log warning
      await expect(fileService.deleteFile(fileId)).resolves.not.toThrow();
      expect(fileService.getFileInfo(fileId)).toBeUndefined();
    });
  });

  describe('cleanupExpiredFiles', () => {
    it('should clean up expired files', async () => {
      const xmlContent = '<mxfile><diagram>test</diagram></mxfile>';
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      const fileId = await fileService.saveDrawioFile(xmlContent);
      
      // Manually expire the file
      const fileInfo = fileService.getFileInfo(fileId);
      if (fileInfo) {
        fileInfo.expiresAt = new Date(Date.now() - 1000); // 1 second ago
      }

      await fileService.cleanupExpiredFiles();

      expect(mockFs.unlink).toHaveBeenCalled();
      expect(fileService.getFileInfo(fileId)).toBeUndefined();
    });

    it('should not clean up non-expired files', async () => {
      const xmlContent = '<mxfile><diagram>test</diagram></mxfile>';
      mockFs.writeFile.mockResolvedValue(undefined);

      const fileId = await fileService.saveDrawioFile(xmlContent);
      await fileService.cleanupExpiredFiles();

      expect(mockFs.unlink).not.toHaveBeenCalled();
      expect(fileService.getFileInfo(fileId)).toBeDefined();
    });
  });
});