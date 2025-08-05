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
        console.warn('Failed to cleanup temporary PNG file:', cleanupError);
      }

      return {
        success: true,
        imageFileId
      };

    } catch (error) {
      console.error('Error generating PNG:', error);
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
        '--export',
        '--format', 'png',
        '--output', outputPath,
        inputPath
      ];

      console.log(`Executing Draw.io CLI: ${this.drawioCliPath} ${args.join(' ')}`);

      const process = spawn(this.drawioCliPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
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
        if (code === 0) {
          console.log('Draw.io CLI executed successfully');
          if (stdout) console.log('CLI stdout:', stdout);
          resolve(true);
        } else {
          console.error(`Draw.io CLI failed with exit code ${code}`);
          if (stderr) console.error('CLI stderr:', stderr);
          if (stdout) console.log('CLI stdout:', stdout);
          resolve(false);
        }
      });

      process.on('error', (error) => {
        console.error('Failed to start Draw.io CLI process:', error);
        resolve(false);
      });

      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.error('Draw.io CLI process timed out');
        process.kill('SIGTERM');
        resolve(false);
      }, 30000); // 30 seconds timeout

      process.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Check if Draw.io CLI is available
   * @returns Promise<boolean>
   */
  async isDrawioCLIAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn(this.drawioCliPath, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill('SIGTERM');
        resolve(false);
      }, 5000);
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
      console.warn('Draw.io CLI is not available. PNG generation will be skipped.');
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