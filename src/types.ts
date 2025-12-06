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
