import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface TempFile {
  id: string;
  originalName: string;
  path: string;
  type: 'drawio' | 'png';
  createdAt: Date;
  expiresAt: Date;
}

export class FileService {
  private tempDir: string;
  private tempFiles: Map<string, TempFile> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(tempDir: string = './temp') {
    this.tempDir = path.resolve(tempDir);
    this.initializeTempDirectory();
    this.startCleanupScheduler();
  }

  /**
   * Initialize the temporary directory
   */
  private async initializeTempDirectory(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Save a .drawio file with the provided XML content
   * @param xml - The Draw.io XML content
   * @returns Promise<string> - The file ID for URL generation
   */
  async saveDrawioFile(xml: string): Promise<string> {
    const fileId = uuidv4();
    const fileName = `${fileId}.drawio`;
    const filePath = path.join(this.tempDir, fileName);
    
    try {
      await fs.writeFile(filePath, xml, 'utf8');
      
      const tempFile: TempFile = {
        id: fileId,
        originalName: fileName,
        path: filePath,
        type: 'drawio',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
      
      this.tempFiles.set(fileId, tempFile);
      return fileId;
    } catch (error) {
      throw new Error(`Failed to save .drawio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save a PNG file
   * @param pngBuffer - The PNG file buffer
   * @returns Promise<string> - The file ID for URL generation
   */
  async savePngFile(pngBuffer: Buffer): Promise<string> {
    const fileId = uuidv4();
    const fileName = `${fileId}.png`;
    const filePath = path.join(this.tempDir, fileName);
    
    try {
      await fs.writeFile(filePath, pngBuffer);
      
      const tempFile: TempFile = {
        id: fileId,
        originalName: fileName,
        path: filePath,
        type: 'png',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
      
      this.tempFiles.set(fileId, tempFile);
      return fileId;
    } catch (error) {
      throw new Error(`Failed to save PNG file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a temporary URL for a file
   * @param fileId - The file ID
   * @param baseUrl - The base URL for the application (default: http://localhost:3001)
   * @returns string - The temporary URL
   */
  generateTempUrl(fileId: string, baseUrl: string = 'http://localhost:3001'): string {
    const tempFile = this.tempFiles.get(fileId);
    if (!tempFile) {
      throw new Error(`File with ID ${fileId} not found`);
    }
    
    if (new Date() > tempFile.expiresAt) {
      throw new Error(`File with ID ${fileId} has expired`);
    }
    
    return `${baseUrl}/api/files/${fileId}`;
  }

  /**
   * Get file information by ID
   * @param fileId - The file ID
   * @returns TempFile | undefined
   */
  getFileInfo(fileId: string): TempFile | undefined {
    return this.tempFiles.get(fileId);
  }

  /**
   * Get the file path for a given file ID
   * @param fileId - The file ID
   * @returns string - The file path
   */
  getFilePath(fileId: string): string {
    const tempFile = this.tempFiles.get(fileId);
    if (!tempFile) {
      throw new Error(`File with ID ${fileId} not found`);
    }
    
    if (new Date() > tempFile.expiresAt) {
      throw new Error(`File with ID ${fileId} has expired`);
    }
    
    return tempFile.path;
  }

  /**
   * Delete a specific file
   * @param fileId - The file ID to delete
   */
  async deleteFile(fileId: string): Promise<void> {
    const tempFile = this.tempFiles.get(fileId);
    if (!tempFile) {
      return; // File doesn't exist, nothing to delete
    }
    
    try {
      await fs.unlink(tempFile.path);
    } catch (error) {
      // File might already be deleted, log but don't throw
      console.warn(`Failed to delete file ${tempFile.path}:`, error);
    }
    
    this.tempFiles.delete(fileId);
  }

  /**
   * Clean up expired files
   */
  async cleanupExpiredFiles(): Promise<void> {
    const now = new Date();
    const expiredFiles: string[] = [];
    
    for (const [fileId, tempFile] of this.tempFiles.entries()) {
      if (now > tempFile.expiresAt) {
        expiredFiles.push(fileId);
      }
    }
    
    for (const fileId of expiredFiles) {
      await this.deleteFile(fileId);
    }
    
    if (expiredFiles.length > 0) {
      console.log(`Cleaned up ${expiredFiles.length} expired files`);
    }
  }

  /**
   * Start the automatic cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredFiles().catch(error => {
        console.error('Error during scheduled cleanup:', error);
      });
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Stop the cleanup scheduler and clean up resources
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Final cleanup
    await this.cleanupExpiredFiles();
  }
}

// Export a singleton instance
export const fileService = new FileService();