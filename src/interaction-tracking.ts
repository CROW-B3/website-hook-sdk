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
 * - Waits for first mouse movement to start tracking
 * - After first movement, sends batches every 500ms continuously
 * - Each batch includes: screenshot + mouse coordinates (if any)
 * - Batches sent even if no mouse movement (to maintain continuous screenshots)
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
      '[InteractionTracking] Initialized with unified tracking (continuous 500ms batches with screenshots + mouse data after first movement)'
    );
  }
}
