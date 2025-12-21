/**
 * @b3-crow/website-hook-sdk
 * A lightweight SDK for capturing user interactions and screenshots on web pages
 */

// Import and re-export namespaces
import { PointerTracking } from './pointer-tracking';
import { VisualTelemetry } from './visual-telemetry';

export { PointerTracking, VisualTelemetry };

/**
 * Configuration for unified interaction tracking
 */
export interface InteractionTrackingConfig {
  logging?: boolean;
}

/**
 * Initialize both visual telemetry and pointer tracking with unified configuration
 */
export function initInteractionTracking(
  config: InteractionTrackingConfig = {}
): void {
  const logging = config.logging ?? false;

  // Initialize screenshot capture with hardcoded configuration
  VisualTelemetry.init({
    interval: 300, // Fixed 300ms interval
    viewportOnly: true, // Always capture viewport only
    quality: 0.92, // Fixed quality
    useCORS: true, // Enable CORS
    backgroundColor: '#ffffff', // White background
    logging,
  });

  // Initialize pointer tracking with hardcoded configuration
  PointerTracking.init({
    logging,
  });
}
