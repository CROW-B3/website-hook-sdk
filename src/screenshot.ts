import html2canvas from 'html2canvas-pro';
import type { SaveOptions, ScreenshotConfig, ScreenshotResult } from './types';
import { ScreenshotError, ScreenshotErrorType } from './types';
import { downloadFile, waitForPageLoad } from './utils';

/**
 * Default configuration for screenshot capture
 */
const DEFAULT_CONFIG: Required<ScreenshotConfig> = {
  useCORS: true,
  allowTaint: false,
  backgroundColor: '#ffffff',
  scale: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  quality: 0.92,
  waitForLoad: true,
  timeout: 5000,
  logging: false,
};

/**
 * Main class for capturing screenshots using html2canvas
 *
 * @example
 * ```typescript
 * const capturer = new ScreenshotCapture({ useCORS: true });
 * const result = await capturer.capture();
 * await capturer.save(result, { filename: 'my-screenshot' });
 * ```
 */
export class ScreenshotCapture {
  private config: Required<ScreenshotConfig>;

  constructor(config: ScreenshotConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Wait for page to be ready for screenshot capture
   */
  private async waitForReady(): Promise<void> {
    if (!this.config.waitForLoad) {
      return;
    }

    try {
      await waitForPageLoad(this.config.timeout);
    } catch (error) {
      throw new ScreenshotError(
        ScreenshotErrorType.TIMEOUT,
        `Timeout waiting for page to load after ${this.config.timeout}ms`,
        error as Error
      );
    }
  }

  /**
   * Convert canvas to blob
   */
  private async canvasToBlob(
    canvas: HTMLCanvasElement,
    format: string = 'png',
    quality: number = 0.92
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        `image/${format}`,
        quality
      );
    });
  }

  /**
   * Capture screenshot of specified element or entire page
   *
   * @param element - DOM element to capture (defaults to document.body)
   * @returns Promise resolving to screenshot result
   *
   * @throws {ScreenshotError} If capture fails
   *
   * @example
   * ```typescript
   * // Capture entire page
   * const result = await capturer.capture();
   *
   * // Capture specific element
   * const element = document.getElementById('my-element');
   * const result = await capturer.capture(element);
   * ```
   */
  async capture(
    element: HTMLElement = document.body
  ): Promise<ScreenshotResult> {
    // Validate element
    if (!element || !(element instanceof HTMLElement)) {
      throw new ScreenshotError(
        ScreenshotErrorType.ELEMENT_NOT_FOUND,
        'Invalid or missing element to capture'
      );
    }

    // Wait for page to be ready
    await this.waitForReady();

    try {
      // Log if enabled
      if (this.config.logging) {
        console.log('[ScreenshotCapture] Starting capture...', {
          element: element.tagName,
          config: this.config,
        });
      }

      // Capture using html2canvas
      const canvas = await html2canvas(element, {
        useCORS: this.config.useCORS,
        allowTaint: this.config.allowTaint,
        backgroundColor: this.config.backgroundColor,
        scale: this.config.scale,
        logging: this.config.logging,
      });

      // Convert to data URL and blob
      const dataUrl = canvas.toDataURL('image/png', this.config.quality);
      const blob = await this.canvasToBlob(canvas, 'png', this.config.quality);

      const result: ScreenshotResult = {
        canvas,
        dataUrl,
        blob,
        width: canvas.width,
        height: canvas.height,
        timestamp: Date.now(),
      };

      if (this.config.logging) {
        console.log('[ScreenshotCapture] Capture successful', {
          width: result.width,
          height: result.height,
        });
      }

      return result;
    } catch (error) {
      // Check if it's a CORS error
      if (error instanceof Error && error.message.includes('tainted')) {
        throw new ScreenshotError(
          ScreenshotErrorType.CORS_ERROR,
          'CORS error: Cannot capture cross-origin images. Try enabling useCORS option or use a proxy.',
          error
        );
      }

      throw new ScreenshotError(
        ScreenshotErrorType.CAPTURE_FAILED,
        `Failed to capture screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error as Error
      );
    }
  }

  /**
   * Save screenshot to local file system (downloads the file)
   *
   * @param result - Screenshot result from capture()
   * @param options - Save options (filename, format, quality)
   *
   * @throws {ScreenshotError} If save fails
   *
   * @example
   * ```typescript
   * const result = await capturer.capture();
   * await capturer.save(result, {
   *   filename: 'my-screenshot',
   *   format: 'png'
   * });
   * ```
   */
  async save(
    result: ScreenshotResult,
    options: SaveOptions = {}
  ): Promise<void> {
    const {
      filename = `screenshot-${result.timestamp}`,
      format = 'png',
      quality = 0.92,
    } = options;

    try {
      // Convert canvas to blob with specified format
      const blob = await this.canvasToBlob(
        result.canvas,
        format === 'jpg' ? 'jpeg' : format,
        quality
      );

      // Generate filename with extension
      const fullFilename = filename.includes('.')
        ? filename
        : `${filename}.${format}`;

      // Download file
      downloadFile(blob, fullFilename);

      if (this.config.logging) {
        console.log('[ScreenshotCapture] Screenshot saved', {
          filename: fullFilename,
          format,
          size: blob.size,
        });
      }
    } catch (error) {
      throw new ScreenshotError(
        ScreenshotErrorType.SAVE_FAILED,
        `Failed to save screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error as Error
      );
    }
  }

  /**
   * Capture and save screenshot in one operation
   *
   * @param element - DOM element to capture (defaults to document.body)
   * @param saveOptions - Save options (filename, format, quality)
   * @returns Promise resolving to screenshot result
   *
   * @example
   * ```typescript
   * const result = await capturer.captureAndSave(document.body, {
   *   filename: 'page-screenshot',
   *   format: 'png'
   * });
   * ```
   */
  async captureAndSave(
    element?: HTMLElement,
    saveOptions?: SaveOptions
  ): Promise<ScreenshotResult> {
    const result = await this.capture(element);
    await this.save(result, saveOptions);
    return result;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ScreenshotConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<ScreenshotConfig>> {
    return { ...this.config };
  }
}
