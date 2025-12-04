import html2canvas from 'html2canvas-pro';
import { downloadFile } from './utils';

import type { PointerCoordinate, PointerCoordinateBatch } from './types';

/**
 * Internal configuration for pointer tracking (not exposed to clients)
 */
interface PointerTrackingConfig {
  enabled?: boolean;
  batchInterval?: number;
  maxBatchSize?: number;
  uploadUrl?: string;
  logging?: boolean;
}

/**
 * Configuration for auto-capture functionality
 */
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
let isPointerTrackingInitialized = false;
const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

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

async function uploadPointerBatch(
  batch: PointerCoordinateBatch,
  uploadUrl: string,
  logging: boolean
): Promise<boolean> {
  try {
    if (logging) {
      console.log('[PointerTracking] Uploading batch:', {
        sessionId: batch.sessionId,
        coordinates: batch.coordinates.length,
        timeRange: `${batch.batchStartTime} - ${batch.batchEndTime}`,
        duration: `${batch.batchEndTime - batch.batchStartTime}ms`,
      });
      console.log(
        '[PointerTracking] First 5 coordinates:',
        batch.coordinates.slice(0, 5)
      );
      console.log(
        '[PointerTracking] Last 5 coordinates:',
        batch.coordinates.slice(-5)
      );
    }

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      throw new Error(
        `Upload failed: ${response.status} ${response.statusText}`
      );
    }

    if (logging) {
      const responseData = await response.json();
      console.log(
        '[PointerTracking] Batch uploaded successfully!',
        responseData
      );
    }

    return true;
  } catch (error) {
    console.error('[PointerTracking] Failed to upload batch:', error);
    return false;
  }
}

/**
 * Initialize pointer coordinate tracking
 */
function initPointerTracking(
  config: Required<PointerTrackingConfig>,
  site: string,
  hostname: string,
  environment: string
): void {
  if (isPointerTrackingInitialized) {
    if (config.logging) {
      console.warn('[PointerTracking] Already initialized. Skipping...');
    }
    return;
  }

  if (!config.enabled) {
    if (config.logging) {
      console.log('[PointerTracking] Disabled by configuration');
    }
    return;
  }

  isPointerTrackingInitialized = true;

  // Buffer to store coordinates
  let coordinateBuffer: PointerCoordinate[] = [];
  let batchStartTime = Date.now();

  if (config.logging) {
    console.log('[PointerTracking] Initializing with config:', {
      ...config,
      sessionId,
    });
  }

  // Pointer move event handler
  const handlePointerMove = (event: PointerEvent) => {
    const coordinate: PointerCoordinate = {
      timestamp: Date.now(),
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      pointerType: event.pointerType,
      pressure: event.pressure,
      pointerId: event.pointerId,
    };

    coordinateBuffer.push(coordinate);

    // If buffer exceeds max size, send immediately
    if (coordinateBuffer.length >= config.maxBatchSize) {
      if (config.logging) {
        console.log(
          `[PointerTracking] Buffer full (${coordinateBuffer.length} coordinates), sending immediately`
        );
      }
      sendBatch();
    }
  };

  // Function to send batched coordinates
  const sendBatch = async () => {
    if (coordinateBuffer.length === 0) {
      return;
    }

    const batchEndTime = Date.now();
    const batch: PointerCoordinateBatch = {
      sessionId,
      coordinates: [...coordinateBuffer],
      batchStartTime,
      batchEndTime,
      url: window.location.href,
      site,
      hostname,
      environment,
    };

    // Clear buffer
    coordinateBuffer = [];
    batchStartTime = Date.now();

    // Console.log for testing
    console.log(
      `[PointerTracking] Batch ready - ${batch.coordinates.length} coordinates over ${batchEndTime - batch.batchStartTime}ms`
    );
    console.log('[PointerTracking] Batch data:', {
      sessionId: batch.sessionId,
      coordinateCount: batch.coordinates.length,
      firstCoordinate: batch.coordinates[0],
      lastCoordinate: batch.coordinates[batch.coordinates.length - 1],
      url: batch.url,
      site: batch.site,
    });

    // Upload to worker
    if (config.uploadUrl) {
      await uploadPointerBatch(batch, config.uploadUrl, config.logging);
    }
  };

  // Set up interval to send batches
  setInterval(sendBatch, config.batchInterval);

  // Listen to pointer events
  document.addEventListener('pointermove', handlePointerMove);

  // Flush remaining coordinates on page unload
  window.addEventListener('beforeunload', () => {
    if (coordinateBuffer.length > 0) {
      if (config.logging) {
        console.log(
          `[PointerTracking] Page unloading, flushing ${coordinateBuffer.length} coordinates`
        );
      }
      sendBatch();
    }
  });

  if (config.logging) {
    console.log(
      `[PointerTracking] Started tracking. Batches will be sent every ${config.batchInterval}ms (${config.batchInterval / 1000}s) or when buffer reaches ${config.maxBatchSize} coordinates`
    );
  }
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
 * Initializes auto-capture functionality for screenshots and pointer tracking
 * @deprecated Use initInteractionTracking from './interaction-tracking' for pointer tracking only
 *
 * @param config - Configuration options for auto-capture
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

  // Base URL for worker (without endpoint path)
  const baseWorkerUrl =
    defaultUploadUrl.replace(/\/screenshot$/, '') || 'http://localhost:3001';

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
    interval: 300, // Default to null (disabled) - only pointer tracking active
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

  // Screenshot capture is now DISABLED by default
  // Only capture if interval is explicitly set to a number
  if (finalConfig.interval && finalConfig.interval > 0) {
    // Capture first screenshot immediately
    if (finalConfig.logging) {
      console.log('[AutoCapture] Capturing first screenshot immediately...');
    }
    captureScreenshot();

    // Set up continuous capture
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

  // Initialize pointer tracking
  const pointerTrackingConfig: Required<PointerTrackingConfig> = {
    enabled: true,
    batchInterval: 1000, // 1 second batching
    maxBatchSize: 1000, // Increased for 1-second batches
    uploadUrl: `${baseWorkerUrl}/pointer-data`,
    logging: finalConfig.logging,
  };

  initPointerTracking(
    pointerTrackingConfig,
    siteName,
    hostname,
    envNodeEnv || 'production'
  );
}
