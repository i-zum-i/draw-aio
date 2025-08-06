import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileService } from './fileService';

export interface ImageGenerationResult {
  success: boolean;
  imageFileId?: string;
  error?: string;
}

export class ImageService {
  private drawioCliPath: string;
  private cliAvailabilityCache: { available: boolean; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 300000; // 5 minute cache to avoid frequent checks

  constructor(drawioCliPath: string = 'drawio') {
    this.drawioCliPath = drawioCliPath;
  }

  /**
   * Generate PNG image from .drawio file using Draw.io CLI
   * @param drawioFilePath - Path to the .drawio file
   * @returns Promise<ImageGenerationResult>
   */
  async generatePNG(drawioFilePath: string): Promise<ImageGenerationResult> {
    try {
      // Verify that the .drawio file exists
      await fs.access(drawioFilePath);

      // Generate output PNG path
      const outputDir = path.dirname(drawioFilePath);
      const baseName = path.basename(drawioFilePath, '.drawio');
      const pngPath = path.join(outputDir, `${baseName}.png`);

      // Execute Draw.io CLI command
      const success = await this.executeDrawioCLI(drawioFilePath, pngPath);
      
      if (!success) {
        return {
          success: false,
          error: 'Failed to generate PNG using Draw.io CLI'
        };
      }

      // Read the generated PNG file
      const pngBuffer = await fs.readFile(pngPath);
      
      // Save PNG to file service and get file ID
      const imageFileId = await fileService.savePngFile(pngBuffer);
      
      // Clean up the temporary PNG file
      try {
        await fs.unlink(pngPath);
      } catch (cleanupError) {
        // Silent cleanup failure - temporary file will be cleaned up later
      }

      return {
        success: true,
        imageFileId
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Execute Draw.io CLI command to convert .drawio to PNG
   * @param inputPath - Path to input .drawio file
   * @param outputPath - Path for output PNG file
   * @returns Promise<boolean> - Success status
   */
  private async executeDrawioCLI(inputPath: string, outputPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const args = [
        inputPath,
        '-F', 'png',
        '-o', outputPath
      ];

      // Execute Draw.io CLI command

      const process = spawn(this.drawioCliPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true  // Enable shell mode for Windows compatibility
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', (error) => {
        resolve(false);
      });

      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        resolve(false);
      }, 30000); // 30 seconds timeout

      process.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Check if Draw.io CLI is available with caching
   * @returns Promise<boolean>
   */
  async isDrawioCLIAvailable(): Promise<boolean> {
    // Use cache if valid
    if (this.cliAvailabilityCache) {
      const now = Date.now();
      const cacheAge = now - this.cliAvailabilityCache.timestamp;
      if (cacheAge < this.CACHE_DURATION) {
        return this.cliAvailabilityCache.available;
      }
    }

    // Check CLI availability
    const available = await this.checkDrawioCLI();
    
    // Cache the result
    this.cliAvailabilityCache = {
      available,
      timestamp: Date.now()
    };

    return available;
  }

  /**
   * Actually check if Draw.io CLI is available
   * @returns Promise<boolean>
   */
  private async checkDrawioCLI(): Promise<boolean> {
    return new Promise((resolve) => {
      // Check CLI availability
      
      let resolved = false;
      const resolveOnce = (result: boolean) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      const process = spawn(this.drawioCliPath, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true  // Enable shell mode for Windows compatibility
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        clearTimeout(timeout);
        resolveOnce(code === 0);
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        resolveOnce(false);
      });

      // Timeout after 10 seconds (for Windows compatibility)
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        resolveOnce(false);
      }, 10000);
    });
  }

  /**
   * Generate PNG with fallback handling
   * @param drawioFilePath - Path to the .drawio file
   * @returns Promise<ImageGenerationResult>
   */
  async generatePNGWithFallback(drawioFilePath: string): Promise<ImageGenerationResult> {
    // First check if Draw.io CLI is available
    const isAvailable = await this.isDrawioCLIAvailable();
    
    if (!isAvailable) {
      return {
        success: false,
        error: 'Draw.io CLI is not installed or not available in PATH. Please install Draw.io CLI to enable PNG generation.'
      };
    }

    return this.generatePNG(drawioFilePath);
  }
}

// Export a singleton instance
export const imageService = new ImageService();