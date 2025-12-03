/**
 * Configuration options for screenshot capture
 */
export interface ScreenshotConfig {
  /**
   * Enable CORS for external images
   * @default true
   */
  useCORS?: boolean;

  /**
   * Allow tainted canvas (may prevent download)
   * @default false
   */
  allowTaint?: boolean;

  /**
   * Background color for transparent elements
   * @default '#ffffff'
   */
  backgroundColor?: string | null;

  /**
   * Scale factor for higher resolution screenshots
   * @default window.devicePixelRatio
   */
  scale?: number;

  /**
   * Image quality (0-1) for JPEG format
   * @default 0.92
   */
  quality?: number;

  /**
   * Wait for all images to load before capturing
   * @default true
   */
  waitForLoad?: boolean;

  /**
   * Maximum time to wait for page load (ms)
   * @default 5000
   */
  timeout?: number;

  /**
   * Logging enabled for debugging
   * @default false
   */
  logging?: boolean;
}

/**
 * Result of screenshot capture operation
 */
export interface ScreenshotResult {
  /**
   * Canvas element containing the screenshot
   */
  canvas: HTMLCanvasElement;

  /**
   * Data URL of the screenshot
   */
  dataUrl: string;

  /**
   * Blob of the screenshot
   */
  blob: Blob;

  /**
   * Width of the captured screenshot
   */
  width: number;

  /**
   * Height of the captured screenshot
   */
  height: number;

  /**
   * Timestamp when screenshot was taken
   */
  timestamp: number;
}

/**
 * Options for saving screenshot locally
 */
export interface SaveOptions {
  /**
   * Filename for the saved screenshot
   * @default 'screenshot-{timestamp}'
   */
  filename?: string;

  /**
   * Image format
   * @default 'png'
   */
  format?: 'png' | 'jpg' | 'jpeg' | 'webp';

  /**
   * Quality for lossy formats (0-1)
   * @default 0.92
   */
  quality?: number;
}

/**
 * Error types for screenshot operations
 */
export enum ScreenshotErrorType {
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  CAPTURE_FAILED = 'CAPTURE_FAILED',
  TIMEOUT = 'TIMEOUT',
  CORS_ERROR = 'CORS_ERROR',
  SAVE_FAILED = 'SAVE_FAILED',
  INVALID_CONFIG = 'INVALID_CONFIG',
}

/**
 * Custom error class for screenshot operations
 */
export class ScreenshotError extends Error {
  constructor(
    public type: ScreenshotErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ScreenshotError';
  }
}

/**
 * Pointer coordinate data point
 */
export interface PointerCoordinate {
  /**
   * Timestamp when coordinate was captured (milliseconds)
   */
  timestamp: number;

  /**
   * X coordinate relative to viewport
   */
  clientX: number;

  /**
   * Y coordinate relative to viewport
   */
  clientY: number;

  /**
   * X coordinate relative to entire page
   */
  pageX: number;

  /**
   * Y coordinate relative to entire page
   */
  pageY: number;

  /**
   * Type of pointer device (mouse, pen, touch)
   */
  pointerType: string;

  /**
   * Pressure of pointer (0-1, if supported)
   */
  pressure: number;

  /**
   * Unique pointer identifier
   */
  pointerId: number;
}

/**
 * Batch of pointer coordinates
 */
export interface PointerCoordinateBatch {
  /**
   * Session identifier for this capture session
   */
  sessionId: string;

  /**
   * Array of pointer coordinates
   */
  coordinates: PointerCoordinate[];

  /**
   * Start timestamp for this batch
   */
  batchStartTime: number;

  /**
   * End timestamp for this batch
   */
  batchEndTime: number;

  /**
   * Page URL when coordinates were captured
   */
  url: string;

  /**
   * Site information
   */
  site?: string;

  /**
   * Hostname
   */
  hostname?: string;

  /**
   * Environment (production, development, etc.)
   */
  environment?: string;
}

/**
 * Configuration for pointer tracking
 */
export interface PointerTrackingConfig {
  /**
   * Enable pointer coordinate tracking
   * @default true
   */
  enabled?: boolean;

  /**
   * Interval in milliseconds to send batched coordinates
   * @default 15
   */
  batchInterval?: number;

  /**
   * Maximum number of coordinates to batch before sending
   * @default 100
   */
  maxBatchSize?: number;

  /**
   * Upload URL for pointer data
   * @default uploadUrl + '/pointer-data'
   */
  uploadUrl?: string;

  /**
   * Enable logging for debugging
   * @default false
   */
  logging?: boolean;
}
