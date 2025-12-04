import type {
  PointerCoordinate,
  PointerCoordinateBatch,
  InteractionTrackingConfig,
} from './types';

/**
 * Internal flag to track pointer tracking initialization
 */
let isPointerTrackingInitialized = false;

/**
 * Session ID for this capture session (generated once per page load)
 */
const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Upload pointer coordinate batch to edge worker
 */
async function uploadPointerBatch(
  batch: PointerCoordinateBatch,
  uploadUrl: string,
  logging: boolean
): Promise<void> {
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

    if (response.ok) {
      if (logging) {
        console.log(
          `[PointerTracking] Successfully uploaded ${batch.coordinates.length} coordinates`
        );
      }
    } else {
      console.error('[PointerTracking] Upload failed:', response.statusText);
    }
  } catch (error) {
    console.error('[PointerTracking] Upload error:', error);
  }
}

/**
 * Initializes interaction tracking to capture user pointer movements
 *
 * HARDCODED CONFIGURATION (cannot be changed by client):
 * - batchInterval: 1000ms (1 second)
 * - maxBatchSize: 1000 coordinates
 * - uploadUrl: Auto-detected from NEXT_PUBLIC_SCREENSHOT_UPLOAD_URL
 *
 * @param config - Configuration options (ONLY logging is configurable)
 *
 * @example
 * ```typescript
 * // Basic usage (logging disabled by default)
 * initInteractionTracking();
 *
 * // Enable debug logs (ONLY client-configurable option)
 * initInteractionTracking({
 *   logging: true  // Enable detailed debug logs
 * });
 * ```
 */
export function initInteractionTracking(
  config: InteractionTrackingConfig = {}
): void {
  // Prevent multiple initializations
  if (isPointerTrackingInitialized) {
    if (config.logging) {
      console.warn('[InteractionTracking] Already initialized. Skipping...');
    }
    return;
  }

  // Check if running in browser
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.error('[InteractionTracking] Must be run in browser environment');
    return;
  }

  isPointerTrackingInitialized = true;

  // Auto-detect site information from current URL
  const hostname = window.location.hostname;
  const siteName = hostname.replace(/^www\./, '').split('.')[0];

  // Get upload URL from environment variable
  // @ts-ignore - process.env may not exist in all environments
  const envUploadUrl =
    typeof process !== 'undefined' && typeof process.env !== 'undefined'
      ? process.env.NEXT_PUBLIC_SCREENSHOT_UPLOAD_URL
      : undefined;
  const defaultUploadUrl = envUploadUrl || 'http://localhost:3001';
  const baseWorkerUrl = defaultUploadUrl.replace(/\/screenshot$/, '');

  // Get environment
  // @ts-ignore - process.env may not exist in all environments
  const environment =
    typeof process !== 'undefined' && typeof process.env !== 'undefined'
      ? process.env.NODE_ENV || 'production'
      : 'production';

  // HARDCODED Configuration (client cannot change these)
  const batchInterval = 1000; // HARDCODED: 1 second batching
  const maxBatchSize = 1000; // HARDCODED: 1000 coordinates max
  const uploadUrl = `${baseWorkerUrl}/pointer-data`; // Auto-constructed from env var

  // Client-configurable options (ONLY this can be changed by client)
  const logging = config.logging ?? false;

  if (logging) {
    console.log('[InteractionTracking] Initializing with config:', {
      batchInterval,
      maxBatchSize,
      uploadUrl,
      sessionId,
      site: siteName,
      hostname,
      environment,
    });
  }

  // Buffer to store coordinates
  let coordinateBuffer: PointerCoordinate[] = [];
  let batchStartTime = Date.now();

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
    if (coordinateBuffer.length >= maxBatchSize) {
      if (logging) {
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
      site: siteName,
      hostname,
      environment,
    };

    // Clear buffer
    coordinateBuffer = [];
    batchStartTime = Date.now();

    // Console.log for testing
    if (logging) {
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
    }

    // Upload to worker
    await uploadPointerBatch(batch, uploadUrl, logging);
  };

  // Set up interval to send batches
  setInterval(sendBatch, batchInterval);

  // Listen to pointer events
  document.addEventListener('pointermove', handlePointerMove);

  // Flush remaining coordinates on page unload
  window.addEventListener('beforeunload', () => {
    if (coordinateBuffer.length > 0) {
      if (logging) {
        console.log(
          `[PointerTracking] Page unloading, flushing ${coordinateBuffer.length} coordinates`
        );
      }
      sendBatch();
    }
  });

  if (logging) {
    console.log(
      `[PointerTracking] Started tracking. Batches will be sent every ${batchInterval}ms (${batchInterval / 1000}s) or when buffer reaches ${maxBatchSize} coordinates`
    );
  }
}
