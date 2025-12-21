import ky from 'ky';
import {
  isBrowserEnvironment,
  getSiteInfo,
  getEnvVar,
  getEnvironment,
} from './utils/environment';
import { NEXT_BASE_URL, ENDPOINT_PATHS } from './utils/constants';

export namespace PointerTracking {
  /**
   * Pointer coordinate data point
   */
  export interface Coordinate {
    timestamp: number;
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
    pointerType: string;
    pressure: number;
    pointerId: number;
  }

  /**
   * Batch of pointer coordinates
   */
  export interface CoordinateBatch {
    sessionId: string;
    coordinates: Coordinate[];
    batchStartTime: number;
    batchEndTime: number;
    url: string;
    site?: string;
    hostname?: string;
    environment?: string;
  }

  /**
   * Configuration for pointer tracking initialization
   */
  export interface Config {
    logging?: boolean;
  }

  const BATCH_INTERVAL_MS = 1000;
  const MAX_BATCH_SIZE = 1000;
  const LOG_PREFIX = '[PointerTracking]';

  let isInitialized = false;
  const sessionId = generateSessionId();

  function generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `session-${timestamp}-${random}`;
  }

  /**
   * Build upload URL from environment configuration
   */
  function buildUploadUrl(): string {
    const envBaseUrl = getEnvVar('NEXT_PUBLIC_BE_BASE_URL');
    const baseUrl = envBaseUrl || NEXT_BASE_URL;
    return `${baseUrl}${ENDPOINT_PATHS.POINTER_DATA}`;
  }

  /**
   * Create pointer coordinate from pointer event
   */
  function createPointerCoordinate(event: PointerEvent): Coordinate {
    return {
      timestamp: Date.now(),
      clientX: event.clientX,
      clientY: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      pointerType: event.pointerType,
      pressure: event.pressure,
      pointerId: event.pointerId,
    };
  }

  /**
   * Create batch from buffer
   */
  function createBatch(
    coordinates: Coordinate[],
    startTime: number,
    siteName: string,
    hostname: string,
    environment: string
  ): CoordinateBatch {
    return {
      sessionId,
      coordinates: [...coordinates],
      batchStartTime: startTime,
      batchEndTime: Date.now(),
      url: window.location.href,
      site: siteName,
      hostname,
      environment,
    };
  }

  /**
   * Log batch information for debugging
   */
  function logBatchInfo(batch: CoordinateBatch, logging: boolean): void {
    if (!logging) return;

    const duration = batch.batchEndTime - batch.batchStartTime;
    console.log(
      `${LOG_PREFIX} Batch ready - ${batch.coordinates.length} coordinates over ${duration}ms`
    );
    console.log(`${LOG_PREFIX} Batch data:`, {
      sessionId: batch.sessionId,
      coordinateCount: batch.coordinates.length,
      firstCoordinate: batch.coordinates[0],
      lastCoordinate: batch.coordinates[batch.coordinates.length - 1],
      url: batch.url,
      site: batch.site,
    });
  }

  /**
   * Log upload details for debugging
   */
  function logUploadAttempt(batch: CoordinateBatch, logging: boolean): void {
    if (!logging) return;

    const duration = batch.batchEndTime - batch.batchStartTime;
    console.log(`${LOG_PREFIX} Uploading batch:`, {
      sessionId: batch.sessionId,
      coordinates: batch.coordinates.length,
      timeRange: `${batch.batchStartTime} - ${batch.batchEndTime}`,
      duration: `${duration}ms`,
    });
    console.log(
      `${LOG_PREFIX} First 5 coordinates:`,
      batch.coordinates.slice(0, 5)
    );
    console.log(
      `${LOG_PREFIX} Last 5 coordinates:`,
      batch.coordinates.slice(-5)
    );
  }

  /**
   * Upload batch to server (fire-and-forget)
   */
  function uploadBatch(
    batch: CoordinateBatch,
    uploadUrl: string,
    logging: boolean
  ): void {
    logUploadAttempt(batch, logging);

    // Fire and forget - send data without waiting for response
    ky.post(uploadUrl, {
      json: batch,
    }).catch(error => {
      console.error(`${LOG_PREFIX} Upload error:`, error);
    });
  }

  /**
   * Initialize pointer tracking with configuration
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
    const uploadUrl = buildUploadUrl();
    const environment = getEnvironment();
    const logging = config.logging ?? false;

    if (logging) {
      console.log(`${LOG_PREFIX} Initializing with config:`, {
        batchInterval: BATCH_INTERVAL_MS,
        maxBatchSize: MAX_BATCH_SIZE,
        uploadUrl,
        sessionId,
        site: siteName,
        hostname,
        environment,
      });
    }

    // Initialize tracking state
    let coordinateBuffer: Coordinate[] = [];
    let batchStartTime = Date.now();

    // Create batch sender
    const sendBatch = (): void => {
      if (coordinateBuffer.length === 0) return;

      const batch = createBatch(
        coordinateBuffer,
        batchStartTime,
        siteName,
        hostname,
        environment
      );

      coordinateBuffer = [];
      batchStartTime = Date.now();

      logBatchInfo(batch, logging);
      uploadBatch(batch, uploadUrl, logging);
    };

    // Create pointer event handler
    const handlePointerMove = (event: PointerEvent): void => {
      const coordinate = createPointerCoordinate(event);
      coordinateBuffer.push(coordinate);

      if (coordinateBuffer.length >= MAX_BATCH_SIZE) {
        if (logging) {
          console.log(
            `${LOG_PREFIX} Buffer full (${coordinateBuffer.length} coordinates), sending immediately`
          );
        }
        sendBatch();
      }
    };

    // Create unload handler
    const handleBeforeUnload = (): void => {
      if (coordinateBuffer.length > 0) {
        if (logging) {
          console.log(
            `${LOG_PREFIX} Page unloading, flushing ${coordinateBuffer.length} coordinates`
          );
        }
        sendBatch();
      }
    };

    // Setup event listeners and interval
    document.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('beforeunload', handleBeforeUnload);
    setInterval(sendBatch, BATCH_INTERVAL_MS);

    if (logging) {
      console.log(
        `${LOG_PREFIX} Started tracking. Batches will be sent every ${BATCH_INTERVAL_MS}ms or when buffer reaches ${MAX_BATCH_SIZE} coordinates`
      );
    }
  }
}
