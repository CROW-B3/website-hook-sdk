/**
 * @b3-crow/website-hook-sdk
 * A lightweight SDK for capturing user interactions and screenshots on web pages
 */

// Auto-capture functionality (periodic screenshot capture)
export { initAutoCapture } from './auto-capture';
export type { AutoCaptureConfig } from './auto-capture';

// Pointer tracking (mouse/touch/pen movement tracking)
export { initPointerTracking } from './pointer-tracking';

// Types and interfaces
export type {
  PointerCoordinate,
  PointerCoordinateBatch,
  PointerTrackingConfig,
} from './types';

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
