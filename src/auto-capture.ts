import html2canvas from 'html2canvas-pro';
import { downloadFile } from './utils';

/**
 * Configuration for auto-capture functionality
 */
export interface AutoCaptureConfig {
  /**
   * Delay in milliseconds before capturing screenshot
   * @default 5000 (5 seconds)
   */
  delay?: number;

  /**
   * Filename for the screenshot (without extension)
   * @default 'screenshot-{timestamp}'
   */
  filename?: string;

  /**
   * Capture only the visible viewport area instead of the full page
   * @default false (captures full page)
   */
  viewportOnly?: boolean;

  /**
   * Enable CORS for external images
   * @default true
   */
  useCORS?: boolean;

  /**
   * Background color for transparent elements
   * @default '#ffffff'
   */
  backgroundColor?: string;

  /**
   * Scale factor for higher resolution screenshots
   * @default window.devicePixelRatio
   */
  scale?: number;

  /**
   * Image quality (0-1)
   * @default 0.92
   */
  quality?: number;

  /**
   * Enable logging for debugging
   * @default false
   */
  logging?: boolean;
}

/**
 * Internal flag to prevent multiple initializations
 */
let isInitialized = false;

/**
 * Converts canvas to blob
 */
async function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
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
      'image/png',
      quality
    );
  });
}

/**
 * Initializes auto-capture functionality that takes a screenshot after a delay
 *
 * @param config - Configuration options for auto-capture
 *
 * @example
 * ```typescript
 * // Basic usage with defaults (5 second delay)
 * initAutoCapture();
 *
 * // Custom configuration
 * initAutoCapture({
 *   delay: 3000,
 *   filename: 'my-website-screenshot',
 *   logging: true
 * });
 * ```
 */
export function initAutoCapture(config: AutoCaptureConfig = {}): void {
  // Prevent multiple initializations
  if (isInitialized) {
    if (config.logging) {
      console.warn('[AutoCapture] Already initialized. Skipping...');
    }
    return;
  }

  // Check if running in browser
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.error('[AutoCapture] Must be run in browser environment');
    return;
  }

  isInitialized = true;

  // Default configuration
  const finalConfig: Required<AutoCaptureConfig> = {
    delay: config.delay ?? 5000,
    filename: config.filename ?? `screenshot-${Date.now()}`,
    viewportOnly: config.viewportOnly ?? false,
    useCORS: config.useCORS ?? true,
    backgroundColor: config.backgroundColor ?? '#ffffff',
    scale: config.scale ?? window.devicePixelRatio,
    quality: config.quality ?? 0.92,
    logging: config.logging ?? false,
  };

  if (finalConfig.logging) {
    console.log('[AutoCapture] Initialized with config:', finalConfig);
  }

  // Set up delayed capture
  setTimeout(async () => {
    try {
      if (finalConfig.logging) {
        console.log(
          `[AutoCapture] Starting capture after ${finalConfig.delay}ms delay...`
        );
      }

      // If viewportOnly is true, capture only the visible area at current scroll position
      if (finalConfig.viewportOnly) {
        // Get current scroll position
        const scrollX = window.scrollX || window.pageXOffset || 0;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (finalConfig.logging) {
          console.log(
            '[AutoCapture] Capturing viewport at current scroll position:',
            {
              scrollX,
              scrollY,
              viewportWidth,
              viewportHeight,
            }
          );
        }

        // Capture the documentElement (html tag) with viewport crop
        const canvas = await html2canvas(document.documentElement, {
          useCORS: finalConfig.useCORS,
          allowTaint: false,
          backgroundColor: finalConfig.backgroundColor,
          scale: finalConfig.scale,
          logging: finalConfig.logging,
          x: scrollX,
          y: scrollY,
          width: viewportWidth,
          height: viewportHeight,
          windowWidth: viewportWidth,
          windowHeight: viewportHeight,
          scrollX: 0,
          scrollY: 0,
          ignoreElements: (element: Element) => {
            return element.tagName === 'SCRIPT';
          },
        });

        if (finalConfig.logging) {
          console.log(
            '[AutoCapture] Screenshot captured, converting to blob...'
          );
        }

        // Convert to blob and download
        const blob = await canvasToBlob(canvas, finalConfig.quality);
        const filename = finalConfig.filename.includes('.')
          ? finalConfig.filename
          : `${finalConfig.filename}.png`;

        downloadFile(blob, filename);

        if (finalConfig.logging) {
          console.log('[AutoCapture] Screenshot downloaded successfully!', {
            width: canvas.width,
            height: canvas.height,
            filename,
            size: `${(blob.size / 1024).toFixed(2)} KB`,
          });
        }
      } else {
        // Capture full page
        if (finalConfig.logging) {
          console.log('[AutoCapture] Capturing full page');
        }

        const canvas = await html2canvas(document.body, {
          useCORS: finalConfig.useCORS,
          allowTaint: false,
          backgroundColor: finalConfig.backgroundColor,
          scale: finalConfig.scale,
          logging: finalConfig.logging,
          ignoreElements: (element: Element) => {
            return element.tagName === 'SCRIPT';
          },
        });

        if (finalConfig.logging) {
          console.log(
            '[AutoCapture] Screenshot captured, converting to blob...'
          );
        }

        // Convert to blob and download
        const blob = await canvasToBlob(canvas, finalConfig.quality);
        const filename = finalConfig.filename.includes('.')
          ? finalConfig.filename
          : `${finalConfig.filename}.png`;

        downloadFile(blob, filename);

        if (finalConfig.logging) {
          console.log('[AutoCapture] Screenshot downloaded successfully!', {
            width: canvas.width,
            height: canvas.height,
            filename,
            size: `${(blob.size / 1024).toFixed(2)} KB`,
          });
        }
      }
    } catch (error) {
      console.error('[AutoCapture] Failed to capture screenshot:', error);
    }
  }, finalConfig.delay);
}
