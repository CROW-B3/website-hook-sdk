/**
 * Pointer coordinate data point
 */
export interface PointerCoordinate {
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
export interface PointerCoordinateBatch {
  sessionId: string;
  coordinates: PointerCoordinate[];
  batchStartTime: number;
  batchEndTime: number;
  url: string;
  site?: string;
  hostname?: string;
  environment?: string;
}

export interface PointerTrackingConfig {
  logging?: boolean;
}

import {
  isBrowserEnvironment,
  getSiteInfo,
  getEnvVar,
  getEnvironment,
} from './utils/environment';
import { NEXT_BASE_URL, ENDPOINT_PATHS } from './utils/constants';

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
function createPointerCoordinate(event: PointerEvent): PointerCoordinate {
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
  coordinates: PointerCoordinate[],
  startTime: number,
  siteName: string,
  hostname: string,
  environment: string
): PointerCoordinateBatch {
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
function logBatchInfo(batch: PointerCoordinateBatch, logging: boolean): void {
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
function logUploadAttempt(
  batch: PointerCoordinateBatch,
  logging: boolean
): void {
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
  console.log(`${LOG_PREFIX} Last 5 coordinates:`, batch.coordinates.slice(-5));
}

/**
 * Upload batch to server
 */
async function uploadBatch(
  batch: PointerCoordinateBatch,
  uploadUrl: string,
  logging: boolean
): Promise<void> {
  try {
    logUploadAttempt(batch, logging);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });

    if (response.ok) {
      if (logging) {
        console.log(
          `${LOG_PREFIX} Successfully uploaded ${batch.coordinates.length} coordinates`
        );
      }
    } else {
      console.error(`${LOG_PREFIX} Upload failed:`, response.statusText);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Upload error:`, error);
  }
}

export function initPointerTracking(config: PointerTrackingConfig = {}): void {
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
  let coordinateBuffer: PointerCoordinate[] = [];
  let batchStartTime = Date.now();

  // Create batch sender
  const sendBatch = async (): Promise<void> => {
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
    await uploadBatch(batch, uploadUrl, logging);
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
