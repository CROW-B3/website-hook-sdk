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
    scrollStopDelay?: number; // Delay in ms after scroll stops before capturing (default: 150ms)
    maxBufferSize?: number; // Max mouse coordinates to buffer before forcing send (default: 10000)
    maxBatchTime?: number; // Max time in ms before forcing batch send (default: 30000ms)
    screenshotQuality?: number;
    useCORS?: boolean;
    backgroundColor?: string;
    logging?: boolean;
  }

  const DEFAULT_SCROLL_STOP_DELAY_MS = 150;
  const DEFAULT_MAX_BUFFER_SIZE = 10000;
  const DEFAULT_MAX_BATCH_TIME_MS = 30000; // 30 seconds
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
   * Initialize unified tracking with scroll-based batching
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
    const scrollStopDelay =
      config.scrollStopDelay ?? DEFAULT_SCROLL_STOP_DELAY_MS;
    const maxBufferSize = config.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
    const maxBatchTime = config.maxBatchTime ?? DEFAULT_MAX_BATCH_TIME_MS;
    const quality = config.screenshotQuality ?? DEFAULT_QUALITY;
    const useCORS = config.useCORS ?? true;
    const backgroundColor = config.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
    const logging = config.logging ?? false;

    if (logging) {
      console.log(`${LOG_PREFIX} Initializing with config:`, {
        scrollStopDelay,
        maxBufferSize,
        maxBatchTime,
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
    let activeBuffer: PointerTracking.CoordinateData[] = [];
    let batchStartTime = Date.now();
    let hasFirstInteraction = false; // Track if user has interacted
    let isCapturingScreenshot = false; // Mutex to prevent concurrent captures
    let scrollDebounceTimer: number | null = null;
    let maxBatchTimeTimer: number | null = null;

    /**
     * Send immediate screenshot on first interaction
     */
    const sendImmediateScreenshot = async (): Promise<void> => {
      try {
        if (logging) {
          console.log(`${LOG_PREFIX} Capturing and sending initial screenshot`);
        }

        const screenshot = await captureViewportScreenshot(
          siteName,
          quality,
          useCORS,
          backgroundColor,
          logging
        );

        const batch: UnifiedBatch = {
          sessionId,
          url: window.location.href,
          site: siteName,
          hostname,
          environment,
          batchStartTime: Date.now(),
          batchEndTime: Date.now(),
        };

        if (screenshot) {
          batch.screenshot = screenshot;
        }

        uploadUnifiedBatch(batch, uploadUrl, logging);
        batchStartTime = Date.now();
      } catch (error) {
        console.error(`${LOG_PREFIX} Error sending initial screenshot:`, error);
      }
    };

    /**
     * Handle scroll stopped - send batch with mouse data and new screenshot
     */
    const onScrollStopped = async (): Promise<void> => {
      // Prevent concurrent screenshot captures
      if (isCapturingScreenshot) {
        if (logging) {
          console.log(
            `${LOG_PREFIX} Already capturing screenshot, skipping scroll-stop trigger`
          );
        }
        return;
      }

      isCapturingScreenshot = true;

      try {
        // Freeze current buffer and start new one
        const frozenBuffer = activeBuffer;
        const frozenStartTime = batchStartTime;
        activeBuffer = [];
        batchStartTime = Date.now();

        if (logging) {
          console.log(
            `${LOG_PREFIX} Scroll stopped, capturing screenshot and sending batch with ${frozenBuffer.length} coordinates`
          );
        }

        // Capture screenshot (async, may take 100-500ms)
        const screenshot = await captureViewportScreenshot(
          siteName,
          quality,
          useCORS,
          backgroundColor,
          logging
        );

        // Create batch with frozen data
        const batch: UnifiedBatch = {
          sessionId,
          url: window.location.href,
          site: siteName,
          hostname,
          environment,
          batchStartTime: frozenStartTime,
          batchEndTime: Date.now(),
        };

        // Add screenshot if captured
        if (screenshot) {
          batch.screenshot = screenshot;
        }

        // Add pointer data if available
        if (frozenBuffer.length > 0) {
          batch.pointerData = {
            coordinates: frozenBuffer,
            coordinateCount: frozenBuffer.length,
          };
        }

        // Upload batch
        uploadUnifiedBatch(batch, uploadUrl, logging);

        // Reset max batch time timer
        if (maxBatchTimeTimer !== null) {
          clearTimeout(maxBatchTimeTimer);
        }
        maxBatchTimeTimer = setTimeout(() => {
          if (logging) {
            console.log(
              `${LOG_PREFIX} Max batch time (${maxBatchTime}ms) reached, forcing batch send`
            );
          }
          onScrollStopped();
        }, maxBatchTime) as unknown as number;
      } catch (error) {
        console.error(`${LOG_PREFIX} Error in scroll-stop handler:`, error);
      } finally {
        isCapturingScreenshot = false;
      }
    };

    /**
     * Handle scroll events with debouncing
     */
    const handleScroll = (): void => {
      // Clear existing debounce timer
      if (scrollDebounceTimer !== null) {
        clearTimeout(scrollDebounceTimer);
      }

      // Set new timer to detect "scroll stopped"
      scrollDebounceTimer = setTimeout(() => {
        onScrollStopped();
      }, scrollStopDelay) as unknown as number;
    };

    /**
     * Handle pointer move events - buffer coordinates
     */
    const handlePointerMove = (event: PointerEvent): void => {
      const coordinate = PointerTracking.createCoordinate(event);
      activeBuffer.push(coordinate);

      // Safety check: force send if buffer gets too large
      if (activeBuffer.length >= maxBufferSize) {
        if (logging) {
          console.warn(
            `${LOG_PREFIX} Buffer overflow (${activeBuffer.length} coordinates), forcing batch send`
          );
        }
        onScrollStopped();
      }
    };

    /**
     * Handle first user interaction - capture and send initial screenshot
     */
    const handleFirstInteraction = (): void => {
      if (hasFirstInteraction) return;

      hasFirstInteraction = true;

      if (logging) {
        console.log(
          `${LOG_PREFIX} First interaction detected, sending initial screenshot`
        );
      }

      // Send immediate screenshot
      sendImmediateScreenshot();

      // Start tracking mouse movements
      document.addEventListener('pointermove', handlePointerMove);

      // Start tracking scrolls
      window.addEventListener('scroll', handleScroll, { passive: true });

      // Remove first interaction listeners (no longer needed)
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);

      // Start max batch time timer
      maxBatchTimeTimer = setTimeout(() => {
        if (logging) {
          console.log(
            `${LOG_PREFIX} Max batch time (${maxBatchTime}ms) reached, forcing batch send`
          );
        }
        onScrollStopped();
      }, maxBatchTime) as unknown as number;
    };

    /**
     * Handle page unload - flush remaining data with sendBeacon
     */
    const handleBeforeUnload = (): void => {
      if (!hasFirstInteraction) return;

      if (logging) {
        console.log(
          `${LOG_PREFIX} Page unloading, flushing final batch with ${activeBuffer.length} coordinates`
        );
      }

      // Clear timers
      if (scrollDebounceTimer !== null) {
        clearTimeout(scrollDebounceTimer);
      }
      if (maxBatchTimeTimer !== null) {
        clearTimeout(maxBatchTimeTimer);
      }

      // Create final batch without screenshot (no time for async capture)
      if (activeBuffer.length > 0) {
        const batch: UnifiedBatch = {
          sessionId,
          url: window.location.href,
          site: siteName,
          hostname,
          environment,
          batchStartTime,
          batchEndTime: Date.now(),
          pointerData: {
            coordinates: activeBuffer,
            coordinateCount: activeBuffer.length,
          },
        };

        // Try to use sendBeacon for more reliable delivery
        try {
          const formData = new FormData();
          formData.append('sessionId', batch.sessionId);
          formData.append('url', batch.url);
          formData.append('site', batch.site);
          formData.append('hostname', batch.hostname);
          formData.append('environment', batch.environment);
          formData.append('batchStartTime', batch.batchStartTime.toString());
          formData.append('batchEndTime', batch.batchEndTime.toString());

          if (batch.pointerData) {
            formData.append(
              'pointerData',
              JSON.stringify(batch.pointerData.coordinates)
            );
            formData.append(
              'coordinateCount',
              batch.pointerData.coordinateCount.toString()
            );
          }

          const sent = navigator.sendBeacon(uploadUrl, formData);
          if (logging) {
            console.log(
              `${LOG_PREFIX} sendBeacon ${sent ? 'succeeded' : 'failed'}`
            );
          }
        } catch (error) {
          console.error(`${LOG_PREFIX} Error in beforeunload:`, error);
        }
      }
    };

    // Setup first interaction listeners
    document.addEventListener('click', handleFirstInteraction, { once: false });
    document.addEventListener('keydown', handleFirstInteraction, {
      once: false,
    });
    document.addEventListener('touchstart', handleFirstInteraction, {
      once: false,
      passive: true,
    });

    // Setup page unload listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    if (logging) {
      console.log(
        `${LOG_PREFIX} Scroll-based tracking initialized. Waiting for first user interaction (click/key/touch) to start tracking`
      );
    }
  }
}
