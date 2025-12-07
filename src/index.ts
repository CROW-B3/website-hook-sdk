/**
 * @b3-crow/website-hook-sdk
 * A lightweight SDK for capturing user interactions and screenshots on web pages
 */

// Export constants
export * from './utils/constants';

// Unified interaction tracking
import { initAutoCapture } from './visual-telemetry';
import { initPointerTracking } from './pointer-tracking';

/**
 * Configuration for unified interaction tracking
 */
export interface InteractionTrackingConfig {
  logging?: boolean;
}

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
