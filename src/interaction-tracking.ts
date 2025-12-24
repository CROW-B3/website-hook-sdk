import { UnifiedTracking } from './unified-tracking';

/**
 * Configuration for unified interaction tracking
 */
export interface Config {
  logging?: boolean;
  batchInterval?: number;
  screenshotQuality?: number;
}

/**
 * Initialize unified interaction tracking
 * - Captures screenshots on mouse movement (not on interval)
 * - Batches both screenshot and pointer data together
 * - Sends bundled data every 500ms (configurable)
 */
export function init(config: Config = {}): void {
  const logging = config.logging ?? false;

  // Initialize unified tracking with new behavior
  UnifiedTracking.init({
    batchInterval: config.batchInterval ?? 500, // Send batches every 500ms
    screenshotQuality: config.screenshotQuality ?? 0.92,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging,
  });

  if (logging) {
    console.log(
      '[InteractionTracking] Initialized with unified tracking (500ms batches, screenshot on mouse movement)'
    );
  }
}
