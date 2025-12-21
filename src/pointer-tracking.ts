import ky from 'ky';
import {
  isBrowserEnvironment,
  getSiteInfo,
  getEnvironment,
} from './utils/environment';
import { NEXT_BASE_URL, ENDPOINT_PATHS } from './constants';

export namespace PointerTracking {
  /**
   * Coordinate namespace - groups coordinate interface and related utilities
   */
  export namespace Coordinate {
    /**
     * Pointer coordinate data point
     */
    export interface Data {
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
     * Create coordinate from pointer event
     */
    export function createFromPointerEvent(event: PointerEvent): Data {
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
  }

  /**
   * Batch namespace - groups batch interface and related utilities
   */
  export namespace Batch {
    /**
     * Batch of pointer coordinates
     */
    export interface Data {
      sessionId: string;
      coordinates: Coordinate.Data[];
      batchStartTime: number;
      batchEndTime: number;
      url: string;
      site?: string;
      hostname?: string;
      environment?: string;
    }

    /**
     * Create batch from buffer
     */
    export function create(
      coordinates: Coordinate.Data[],
      sessionId: string,
      startTime: number,
      siteName: string,
      hostname: string,
      environment: string
    ): Data {
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
    export function logInfo(batch: Data, logging: boolean): void {
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
    export function logUploadAttempt(batch: Data, logging: boolean): void {
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
    export function upload(
      batch: Data,
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
    return `${NEXT_BASE_URL}${ENDPOINT_PATHS.POINTER_DATA}`;
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
    let coordinateBuffer: Coordinate.Data[] = [];
    let batchStartTime = Date.now();

    // Create batch sender
    const sendBatch = (): void => {
      if (coordinateBuffer.length === 0) return;

      const batch = Batch.create(
        coordinateBuffer,
        sessionId,
        batchStartTime,
        siteName,
        hostname,
        environment
      );

      coordinateBuffer = [];
      batchStartTime = Date.now();

      Batch.logInfo(batch, logging);
      Batch.upload(batch, uploadUrl, logging);
    };

    // Create pointer event handler
    const handlePointerMove = (event: PointerEvent): void => {
      const coordinate = Coordinate.createFromPointerEvent(event);
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
