import html2canvas from 'html2canvas-pro';
import { downloadFile } from './utils';

/**
 * Configuration for auto-capture functionality
 */
export interface AutoCaptureConfig {
  /**
   * Interval in milliseconds for continuous screenshot capture
   * If set, screenshots will be captured repeatedly at this interval
   * @default 1000 (1 second) - captures every second
   */
  interval?: number;

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
   * Cloudflare Edge Worker URL to upload screenshot
   * If provided, screenshot will be uploaded instead of downloaded
   * @example 'https://your-worker.workers.dev/screenshot'
   */
  uploadUrl?: string;

  /**
   * Additional metadata to send with the screenshot upload
   * @default {}
   */
  uploadMetadata?: Record<string, any>;

  /**
   * Download screenshot locally if upload fails
   * @default true
   */
  downloadOnUploadFail?: boolean;

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
 * Upload screenshot to edge worker using FormData
 */
async function uploadScreenshot(
  blob: Blob,
  filename: string,
  uploadUrl: string,
  metadata: Record<string, any>,
  logging: boolean
): Promise<boolean> {
  try {
    if (logging) {
      console.log('[AutoCapture] Uploading screenshot to:', uploadUrl);
    }

    // Create FormData with screenshot and metadata
    const formData = new FormData();
    formData.append('screenshot', blob, filename);
    formData.append('filename', filename);
    formData.append('timestamp', Date.now().toString());
    formData.append('url', window.location.href);
    formData.append('userAgent', navigator.userAgent);
    formData.append(
      'viewport',
      JSON.stringify({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX || window.pageXOffset,
        scrollY: window.scrollY || window.pageYOffset,
      })
    );

    // Add custom metadata
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      );
    });

    // Upload to edge worker
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        `Upload failed: ${response.status} ${response.statusText}`
      );
    }

    if (logging) {
      console.log('[AutoCapture] Screenshot uploaded successfully!', {
        status: response.status,
        size: `${(blob.size / 1024).toFixed(2)} KB`,
      });
    }

    return true;
  } catch (error) {
    console.error('[AutoCapture] Failed to upload screenshot:', error);
    return false;
  }
}

/**
 * Initializes auto-capture functionality that takes screenshots immediately and optionally continuously
 *
 * @param config - Configuration options for auto-capture
 *
 * @example
 * ```typescript
 * // Basic usage - captures immediately once
 * initAutoCapture();
 *
 * // Continuous capture every 5 seconds
 * initAutoCapture({
 *   interval: 5000,
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

  // Auto-detect site information from current URL
  const hostname = window.location.hostname;
  const siteName = hostname.replace(/^www\./, '').split('.')[0];

  // Get upload URL from environment variable or config
  // @ts-ignore - process.env may not exist in all environments
  const envUploadUrl =
    typeof process !== 'undefined' && typeof process.env !== 'undefined'
      ? process.env.NEXT_PUBLIC_SCREENSHOT_UPLOAD_URL
      : undefined;
  const defaultUploadUrl = envUploadUrl || 'http://localhost:3001/screenshot';

  // Auto-generate metadata based on current site
  // @ts-ignore - process.env may not exist in all environments
  const envNodeEnv =
    typeof process !== 'undefined' && typeof process.env !== 'undefined'
      ? process.env.NODE_ENV
      : undefined;
  const defaultMetadata = {
    site: siteName,
    hostname: hostname,
    environment: envNodeEnv || 'production',
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    ...config.uploadMetadata, // Allow override
  };

  // Default configuration
  const finalConfig = {
    interval: config.interval, // Optional - only set if user wants continuous capture
    filename: config.filename ?? `${siteName}-screenshot-${Date.now()}`,
    viewportOnly: config.viewportOnly ?? true,
    uploadUrl: config.uploadUrl ?? defaultUploadUrl,
    uploadMetadata: defaultMetadata,
    downloadOnUploadFail: config.downloadOnUploadFail ?? true,
    useCORS: config.useCORS ?? true,
    backgroundColor: config.backgroundColor ?? '#ffffff',
    scale: config.scale ?? window.devicePixelRatio,
    quality: config.quality ?? 0.92,
    logging: config.logging ?? false,
  };

  if (finalConfig.logging) {
    console.log('[AutoCapture] Initialized with config:', finalConfig);
  }

  // Define the capture function that will be called repeatedly
  const captureScreenshot = async () => {
    try {
      // Generate unique filename with timestamp for each capture
      const timestamp = Date.now();
      const filenameBase = `${siteName}-screenshot-${timestamp}`;

      // Update metadata timestamp for each capture
      const captureMetadata = {
        ...defaultMetadata,
        timestamp,
      };

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

        // Convert to blob
        const blob = await canvasToBlob(canvas, finalConfig.quality);
        const filename = `${filenameBase}.png`;

        // Upload to edge worker if URL is provided
        if (finalConfig.uploadUrl) {
          const uploadSuccess = await uploadScreenshot(
            blob,
            filename,
            finalConfig.uploadUrl,
            captureMetadata,
            finalConfig.logging
          );

          // Fallback to download if upload fails and fallback is enabled
          if (!uploadSuccess && finalConfig.downloadOnUploadFail) {
            if (finalConfig.logging) {
              console.log(
                '[AutoCapture] Upload failed, downloading locally...'
              );
            }
            downloadFile(blob, filename);
          }
        } else {
          // No upload URL, download locally
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

        // Convert to blob
        const blob = await canvasToBlob(canvas, finalConfig.quality);
        const filename = `${filenameBase}.png`;

        // Upload to edge worker if URL is provided
        if (finalConfig.uploadUrl) {
          const uploadSuccess = await uploadScreenshot(
            blob,
            filename,
            finalConfig.uploadUrl,
            captureMetadata,
            finalConfig.logging
          );

          // Fallback to download if upload fails and fallback is enabled
          if (!uploadSuccess && finalConfig.downloadOnUploadFail) {
            if (finalConfig.logging) {
              console.log(
                '[AutoCapture] Upload failed, downloading locally...'
              );
            }
            downloadFile(blob, filename);
          }
        } else {
          // No upload URL, download locally
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
      }
    } catch (error) {
      console.error('[AutoCapture] Failed to capture screenshot:', error);
    }
  };

  // Capture first screenshot immediately
  if (finalConfig.logging) {
    console.log('[AutoCapture] Capturing screenshot immediately...');
  }
  captureScreenshot();

  // Set up continuous capture if interval is specified
  if (finalConfig.interval) {
    if (finalConfig.logging) {
      console.log(
        `[AutoCapture] Setting up continuous capture every ${finalConfig.interval}ms`
      );
    }

    setInterval(() => {
      captureScreenshot();
    }, finalConfig.interval);
  }
}
