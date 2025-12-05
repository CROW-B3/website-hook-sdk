/**
 * @b3-crow/website-hook-sdk
 * A lightweight SDK for capturing screenshots and user interactions on web pages
 */

// Main screenshot capture class
export { ScreenshotCapture } from './screenshot';

// Auto-capture functionality
export { initAutoCapture } from './auto-capture';
export type { AutoCaptureConfig } from './auto-capture';

// Interaction tracking (pointer movements tracking)
export { initInteractionTracking } from './interaction-tracking';

// Types and interfaces
export type {
  ScreenshotConfig,
  ScreenshotResult,
  SaveOptions,
  PointerCoordinate,
  PointerCoordinateBatch,
  InteractionTrackingConfig,
} from './types';

// Error types
export { ScreenshotError, ScreenshotErrorType } from './types';

// Utility functions (optional exports for advanced users)
export {
  waitForPageLoad,
  waitForImages,
  downloadFile,
  getImagesInElement,
  checkBrowserSupport,
  formatFileSize,
  generateTimestampFilename,
} from './utils';
