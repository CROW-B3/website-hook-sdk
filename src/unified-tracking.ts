import {
  isBrowserEnvironment,
  getSiteInfo,
  getEnvironment,
} from './utils/environment';
import { NEXT_BASE_URL, ENDPOINT_PATHS } from './constants';
import { BaseTracking } from './base-tracking';
import { PointerTracking } from './pointer-tracking';
import * as ScreenshotUtils from './utils/screenshot';

export namespace UnifiedTracking {
  /**
   * Unified batch containing both screenshot and pointer data
   */
  export interface UnifiedBatch {
    sessionId: string;
    url: string;
    site: string;
    hostname: string;
    environment: string;
    batchStartTime: number;
    batchEndTime: number;
    screenshot?: {
      blob: Blob;
      filename: string;
      timestamp: number;
      viewport: ScreenshotUtils.ViewportInfo;
      userAgent: string;
    };
    pointerData?: {
      coordinates: PointerTracking.CoordinateData[];
      coordinateCount: number;
    };
  }

  /**
   * Configuration for unified tracking
   */
  export interface Config {
    batchInterval?: number;
    screenshotQuality?: number;
    useCORS?: boolean;
    backgroundColor?: string;
    logging?: boolean;
  }

  const DEFAULT_BATCH_INTERVAL_MS = 500;
  const DEFAULT_QUALITY = 0.92;
  const DEFAULT_BACKGROUND_COLOR = '#ffffff';
  const LOG_PREFIX = '[UnifiedTracking]';

  let isInitialized = false;
  const sessionId = BaseTracking.generateSessionId();

  /**
   * Build upload URL for unified endpoint
   */
  function buildUploadUrl(): string {
    return `${NEXT_BASE_URL}${ENDPOINT_PATHS.UNIFIED_INTERACTION}`;
  }

  /**
   * Capture viewport screenshot using shared utilities
   */
  async function captureViewportScreenshot(
    siteName: string,
    quality: number,
    useCORS: boolean,
    backgroundColor: string,
    logging: boolean
  ): Promise<UnifiedBatch['screenshot'] | null> {
    try {
      const result = await ScreenshotUtils.captureViewportScreenshot({
        quality,
        useCORS,
        backgroundColor,
        logging,
      });

      const filename = `${siteName}-screenshot-${result.timestamp}.png`;

      return {
        blob: result.blob,
        filename,
        timestamp: result.timestamp,
        viewport: result.viewport,
        userAgent: navigator.userAgent,
      };
    } catch (error) {
      console.error(`${LOG_PREFIX} Failed to capture screenshot:`, error);
      return null;
    }
  }

  /**
   * Upload unified batch to server
   */
  function uploadUnifiedBatch(
    batch: UnifiedBatch,
    uploadUrl: string,
    logging: boolean
  ): void {
    const formData = new FormData();

    // Add batch metadata
    formData.append('sessionId', batch.sessionId);
    formData.append('url', batch.url);
    formData.append('site', batch.site);
    formData.append('hostname', batch.hostname);
    formData.append('environment', batch.environment);
    formData.append('batchStartTime', batch.batchStartTime.toString());
    formData.append('batchEndTime', batch.batchEndTime.toString());

    // Add screenshot if available
    if (batch.screenshot) {
      formData.append(
        'screenshot',
        batch.screenshot.blob,
        batch.screenshot.filename
      );
      formData.append('screenshotFilename', batch.screenshot.filename);
      formData.append(
        'screenshotTimestamp',
        batch.screenshot.timestamp.toString()
      );
      formData.append('viewport', JSON.stringify(batch.screenshot.viewport));
      formData.append('userAgent', batch.screenshot.userAgent);
    }

    // Add pointer data if available
    if (batch.pointerData && batch.pointerData.coordinates.length > 0) {
      formData.append(
        'pointerData',
        JSON.stringify(batch.pointerData.coordinates)
      );
      formData.append(
        'coordinateCount',
        batch.pointerData.coordinateCount.toString()
      );
    }

    if (logging) {
      console.log(`${LOG_PREFIX} Uploading unified batch:`, {
        sessionId: batch.sessionId,
        batchStartTime: batch.batchStartTime,
        batchEndTime: batch.batchEndTime,
        hasScreenshot: !!batch.screenshot,
        pointerCoordinates: batch.pointerData?.coordinateCount ?? 0,
      });
    }

    BaseTracking.uploadFormData(formData, uploadUrl, {
      prefix: LOG_PREFIX,
      logging,
    });
  }

  /**
   * Initialize unified tracking
   */
  export function init(config: Config = {}): void {
    if (isInitialized) {
      if (config.logging) {
        console.warn(`${LOG_PREFIX} Already initialized. Skipping...`);
      }
      return;
    }

    if (!isBrowserEnvironment()) {
      console.error(`${LOG_PREFIX} Must be run in browser environment`);
      return;
    }

    isInitialized = true;

    // Extract configuration
    const { hostname, siteName } = getSiteInfo();
    const environment = getEnvironment();
    const uploadUrl = buildUploadUrl();
    const batchInterval = config.batchInterval ?? DEFAULT_BATCH_INTERVAL_MS;
    const quality = config.screenshotQuality ?? DEFAULT_QUALITY;
    const useCORS = config.useCORS ?? true;
    const backgroundColor = config.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
    const logging = config.logging ?? false;

    if (logging) {
      console.log(`${LOG_PREFIX} Initializing with config:`, {
        batchInterval,
        quality,
        useCORS,
        backgroundColor,
        uploadUrl,
        sessionId,
        site: siteName,
        hostname,
        environment,
      });
    }

    // Tracking state
    let coordinateBuffer: PointerTracking.CoordinateData[] = [];
    let batchStartTime = Date.now();
    let hasStartedTracking = false; // Track if we've started sending batches
    let intervalId: number | null = null;

    /**
     * Send unified batch
     */
    const sendBatch = async (): Promise<void> => {
      const batchEndTime = Date.now();

      // After first mouse movement, always send batches (even if no data)
      // This ensures continuous 500ms updates
      if (!hasStartedTracking) {
        // Don't send if tracking hasn't started yet
        return;
      }

      let screenshot: UnifiedBatch['screenshot'] | null = null;

      // Capture screenshot in every batch after tracking starts
      screenshot = await captureViewportScreenshot(
        siteName,
        quality,
        useCORS,
        backgroundColor,
        logging
      );

      // Create unified batch
      const batch: UnifiedBatch = {
        sessionId,
        url: window.location.href,
        site: siteName,
        hostname,
        environment,
        batchStartTime,
        batchEndTime,
      };

      // Add screenshot if captured
      if (screenshot) {
        batch.screenshot = screenshot;
      }

      // Add pointer data if available
      if (coordinateBuffer.length > 0) {
        batch.pointerData = {
          coordinates: [...coordinateBuffer],
          coordinateCount: coordinateBuffer.length,
        };
      }

      // Reset state for next batch
      coordinateBuffer = [];
      batchStartTime = Date.now();

      // Always upload batch after tracking has started
      // This ensures continuous 500ms updates even if no mouse movement
      uploadUnifiedBatch(batch, uploadUrl, logging);
    };

    /**
     * Handle pointer move events
     */
    const handlePointerMove = (event: PointerEvent): void => {
      // Add coordinate to buffer
      const coordinate = PointerTracking.createCoordinate(event);
      coordinateBuffer.push(coordinate);

      // On first mouse movement, start continuous batching with screenshots
      if (!hasStartedTracking) {
        hasStartedTracking = true;

        if (logging) {
          console.log(
            `${LOG_PREFIX} First mouse movement detected, starting continuous batching with screenshots every ${batchInterval}ms`
          );
        }
      }
    };

    /**
     * Handle page unload - flush remaining data
     */
    const handleBeforeUnload = (): void => {
      if (hasStartedTracking) {
        if (logging) {
          console.log(
            `${LOG_PREFIX} Page unloading, flushing final batch with ${coordinateBuffer.length} coordinates`
          );
        }
        // Clear interval to prevent duplicate sends
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
        sendBatch();
      }
    };

    // Setup event listeners
    document.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Setup batch interval - runs every 500ms continuously
    intervalId = setInterval(sendBatch, batchInterval) as unknown as number;

    if (logging) {
      console.log(
        `${LOG_PREFIX} Unified tracking initialized. Waiting for first mouse movement to start continuous ${batchInterval}ms batching (screenshots + mouse data)`
      );
    }
  }
}
