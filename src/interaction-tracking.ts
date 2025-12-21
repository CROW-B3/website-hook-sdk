import { PointerTracking } from './pointer-tracking';
import { VisualTelemetry } from './visual-telemetry';

/**
 * Configuration for unified interaction tracking
 */
export interface Config {
  logging?: boolean;
}

/**
 * Initialize both visual telemetry and pointer tracking with unified configuration
 */
export function init(config: Config = {}): void {
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
