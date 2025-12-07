/**
 * @b3-crow/website-hook-sdk
 * A lightweight SDK for capturing user interactions and screenshots on web pages
 */

// Visual telemetry functionality (periodic viewport capture with rich metadata)
export { initAutoCapture } from './visual-telemetry';
export type { AutoCaptureConfig } from './visual-telemetry';

// Pointer tracking (mouse/touch/pen movement tracking)
export { initPointerTracking } from './pointer-tracking';

// Types and interfaces
export type {
  PointerCoordinate,
  PointerCoordinateBatch,
  PointerTrackingConfig,
} from './pointer-tracking';
