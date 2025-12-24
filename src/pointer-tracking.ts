import {
  isBrowserEnvironment,
  getSiteInfo,
  getEnvironment,
} from './utils/environment';
import { NEXT_BASE_URL, ENDPOINT_PATHS } from './constants';
import { BaseTracking } from './base-tracking';

export namespace PointerTracking {
  /**
   * Pointer coordinate data point
   */
  export interface CoordinateData {
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
  export interface BatchData extends BaseTracking.BaseBatchData {
    coordinates: CoordinateData[];
  }

  /**
   * Configuration for pointer tracking initialization
   */
  export interface Config {
    logging?: boolean;
  }

  /**
   * Create coordinate from pointer event
   */
  export function createCoordinate(event: PointerEvent): CoordinateData {
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
  export function createBatch(
    coordinates: CoordinateData[],
    sessionId: string,
    startTime: number,
    siteName: string,
    hostname: string,
    environment: string
  ): BatchData {
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
  export function logBatchInfo(batch: BatchData, logging: boolean): void {
    BaseTracking.logBatchInfo(
      batch,
      { prefix: LOG_PREFIX, logging },
      {
        coordinateCount: batch.coordinates.length,
        firstCoordinate: batch.coordinates[0],
        lastCoordinate: batch.coordinates[batch.coordinates.length - 1],
      }
    );
  }

  /**
   * Upload batch to server (fire-and-forget)
   */
  export function uploadBatch(
    batch: BatchData,
    uploadUrl: string,
    logging: boolean
  ): void {
    BaseTracking.uploadBatchJSON(
      batch,
      uploadUrl,
      { prefix: LOG_PREFIX, logging },
      {
        coordinates: batch.coordinates.length,
        firstCoordinates: batch.coordinates.slice(0, 5),
        lastCoordinates: batch.coordinates.slice(-5),
      }
    );
  }

  const BATCH_INTERVAL_MS = 1000;
  const MAX_BATCH_SIZE = 1000;
  const LOG_PREFIX = '[PointerTracking]';

  let isInitialized = false;
  const sessionId = BaseTracking.generateSessionId();

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
    let coordinateBuffer: CoordinateData[] = [];
    let batchStartTime = Date.now();

    // Create batch sender
    const sendBatch = (): void => {
      if (coordinateBuffer.length === 0) return;

      const batch = createBatch(
        coordinateBuffer,
        sessionId,
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
      const coordinate = createCoordinate(event);
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
