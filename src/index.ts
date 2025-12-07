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

// Unified interaction tracking
import { initAutoCapture } from './visual-telemetry';
import { initPointerTracking } from './pointer-tracking';

/**
 * Configuration for unified interaction tracking
 */
export interface InteractionTrackingConfig {
  logging?: boolean;
}
/**
 * Initialize all interaction tracking with hardcoded optimal configurations.
 * This function sets up:
 * - Screenshot capture (visual telemetry) with fixed 300ms interval
 * - Mouse/pointer movement tracking with batching
 *
 * All configurations are hardcoded for optimal performance and cannot be customized.
 *
 * @param config - Optional configuration (only logging can be toggled)
 */
export function initInteractionTracking(
  config: InteractionTrackingConfig = {}
): void {
  const logging = config.logging ?? false;

  // Initialize screenshot capture with hardcoded configuration
  initAutoCapture({
    interval: 300, // Fixed 300ms interval
    viewportOnly: true, // Always capture viewport only
    quality: 0.92, // Fixed quality
    useCORS: true, // Enable CORS
    backgroundColor: '#ffffff', // White background
    logging,
  });

  // Initialize pointer tracking with hardcoded configuration
  initPointerTracking({
    logging,
  });
}
