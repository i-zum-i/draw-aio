import { spawn } from 'child_process';
import fs from 'fs/promises';
import { ImageService } from '../imageService';
import { fileService } from '../fileService';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('../fileService', () => ({
  fileService: {
    savePngFile: jest.fn(),
  },
}));

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockFileService = fileService as jest.Mocked<typeof fileService>;

// Mock EventEmitter for child process
class MockChildProcess {
  stdout = { on: jest.fn() };
  stderr = { on: jest.fn() };
  on = jest.fn();
  kill = jest.fn();
}

describe('ImageService', () => {
  let imageService: ImageService;
  let mockProcess: MockChildProcess;

  beforeEach(() => {
    jest.clearAllMocks();
    imageService = new ImageService('drawio');
    mockProcess = new MockChildProcess();
    mockSpawn.mockReturnValue(mockProcess as any);
  });

  describe('generatePNG', () => {
    const testDrawioPath = '/tmp/test.drawio';
    const testPngPath = '/tmp/test.png';
    const testPngBuffer = Buffer.from('fake png data');

    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(testPngBuffer);
      mockFs.unlink.mockResolvedValue(undefined);
      mockFileService.savePngFile.mockResolvedValue('test-png-id');
    });

    it('should successfully generate PNG from .drawio file', async () => {
      // Mock successful CLI execution
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10); // Exit code 0 = success
        }
        return mockProcess;
      });

      const result = await imageService.generatePNG(testDrawioPath);

      expect(result.success).toBe(true);
      expect(result.imageFileId).toBe('test-png-id');
      expect(result.error).toBeUndefined();

      expect(mockSpawn).toHaveBeenCalledWith('drawio', [
        '--export',
        '--format', 'png',
        '--output', testPngPath,
        testDrawioPath
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      expect(mockFs.readFile).toHaveBeenCalledWith(testPngPath);
      expect(mockFileService.savePngFile).toHaveBeenCalledWith(testPngBuffer);
      expect(mockFs.unlink).toHaveBeenCalledWith(testPngPath);
    });

    it('should handle CLI execution failure', async () => {
      // Mock failed CLI execution
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10); // Exit code 1 = failure
        }
        return mockProcess;
      });

      const result = await imageService.generatePNG(testDrawioPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate PNG using Draw.io CLI');
      expect(result.imageFileId).toBeUndefined();
    });

    it('should handle missing .drawio file', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await imageService.generatePNG(testDrawioPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should handle PNG file read error', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      mockFs.readFile.mockRejectedValue(new Error('Failed to read PNG'));

      const result = await imageService.generatePNG(testDrawioPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to read PNG');
    });

    it('should handle file service save error', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      mockFileService.savePngFile.mockRejectedValue(new Error('Save failed'));

      const result = await imageService.generatePNG(testDrawioPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Save failed');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      mockFs.unlink.mockRejectedValue(new Error('Cleanup failed'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await imageService.generatePNG(testDrawioPath);

      expect(result.success).toBe(true);
      expect(result.imageFileId).toBe('test-png-id');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to cleanup temporary PNG file:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle process spawn error', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Spawn failed')), 10);
        }
        return mockProcess;
      });

      const result = await imageService.generatePNG(testDrawioPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate PNG using Draw.io CLI');
    });
  });

  describe('isDrawioCLIAvailable', () => {
    it('should return true when CLI is available', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10); // Exit code 0 = success
        }
        return mockProcess;
      });

      const result = await imageService.isDrawioCLIAvailable();

      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('drawio', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
    });

    it('should return false when CLI is not available', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10); // Exit code 1 = failure
        }
        return mockProcess;
      });

      const result = await imageService.isDrawioCLIAvailable();

      expect(result).toBe(false);
    });

    it('should return false when spawn fails', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Spawn failed')), 10);
        }
        return mockProcess;
      });

      const result = await imageService.isDrawioCLIAvailable();

      expect(result).toBe(false);
    });
  });

  describe('generatePNGWithFallback', () => {
    it('should generate PNG when CLI is available', async () => {
      // Mock CLI availability check
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(Buffer.from('fake png'));
      mockFs.unlink.mockResolvedValue(undefined);
      mockFileService.savePngFile.mockResolvedValue('test-png-id');

      const result = await imageService.generatePNGWithFallback('/tmp/test.drawio');

      expect(result.success).toBe(true);
      expect(result.imageFileId).toBe('test-png-id');
    });

    it('should return error when CLI is not available', async () => {
      // Mock CLI unavailability
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10); // CLI not available
        }
        return mockProcess;
      });

      const result = await imageService.generatePNGWithFallback('/tmp/test.drawio');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Draw.io CLI is not installed');
    });
  });
});