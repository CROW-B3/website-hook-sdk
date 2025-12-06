import html2canvas from 'html2canvas-pro';
import { downloadFile } from './utils';

/** Auto-capture configuration */
export interface AutoCaptureConfig {
  interval?: number | null;
  filename?: string;
  viewportOnly?: boolean;
  uploadUrl?: string;
  uploadMetadata?: Record<string, any>;
  downloadOnUploadFail?: boolean;
  useCORS?: boolean;
  backgroundColor?: string;
  scale?: number;
  quality?: number;
  logging?: boolean;
}

let isInitialized = false;

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

/** Upload screenshot to edge worker */
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

    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      );
    });

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
 * Initializes periodic screenshot auto-capture
 * Note: For pointer tracking, use initPointerTracking instead
 */
export function initAutoCapture(config: AutoCaptureConfig = {}): void {
  if (isInitialized) {
    if (config.logging) {
      console.warn('[AutoCapture] Already initialized. Skipping...');
    }
    return;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.error('[AutoCapture] Must be run in browser environment');
    return;
  }

  isInitialized = true;

  const hostname = window.location.hostname;
  const siteName = hostname.replace(/^www\./, '').split('.')[0];

  // @ts-ignore - process.env may not exist in all environments
  const envUploadUrl =
    typeof process !== 'undefined' && typeof process.env !== 'undefined'
      ? process.env.NEXT_PUBLIC_SCREENSHOT_UPLOAD_URL
      : undefined;
  const defaultUploadUrl = envUploadUrl || 'http://localhost:3001/screenshot';

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
    ...config.uploadMetadata,
  };

  const finalConfig = {
    interval: 300,
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

  const captureScreenshot = async () => {
    try {
      const timestamp = Date.now();
      const filenameBase = `${siteName}-screenshot-${timestamp}`;

      const captureMetadata = {
        ...defaultMetadata,
        timestamp,
      };

      // Viewport-only: capture current visible area
      if (finalConfig.viewportOnly) {
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

        const blob = await canvasToBlob(canvas, finalConfig.quality);
        const filename = `${filenameBase}.png`;

        if (finalConfig.uploadUrl) {
          const uploadSuccess = await uploadScreenshot(
            blob,
            filename,
            finalConfig.uploadUrl,
            captureMetadata,
            finalConfig.logging
          );

          // Fallback: download locally if upload fails
          if (!uploadSuccess && finalConfig.downloadOnUploadFail) {
            if (finalConfig.logging) {
              console.log(
                '[AutoCapture] Upload failed, downloading locally...'
              );
            }
            downloadFile(blob, filename);
          }
        } else {
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
        // Full page capture
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

        const blob = await canvasToBlob(canvas, finalConfig.quality);
        const filename = `${filenameBase}.png`;

        if (finalConfig.uploadUrl) {
          const uploadSuccess = await uploadScreenshot(
            blob,
            filename,
            finalConfig.uploadUrl,
            captureMetadata,
            finalConfig.logging
          );

          // Fallback: download locally if upload fails
          if (!uploadSuccess && finalConfig.downloadOnUploadFail) {
            if (finalConfig.logging) {
              console.log(
                '[AutoCapture] Upload failed, downloading locally...'
              );
            }
            downloadFile(blob, filename);
          }
        } else {
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

  // Start interval-based capture if enabled
  if (finalConfig.interval && finalConfig.interval > 0) {
    if (finalConfig.logging) {
      console.log('[AutoCapture] Capturing first screenshot immediately...');
    }
    captureScreenshot();

    if (finalConfig.logging) {
      console.log(
        `[AutoCapture] Setting up continuous screenshot capture every ${finalConfig.interval}ms`
      );
    }

    setInterval(() => {
      captureScreenshot();
    }, finalConfig.interval);
  } else {
    if (finalConfig.logging) {
      console.log('[AutoCapture] Screenshot capture DISABLED (interval: null)');
    }
  }
}
