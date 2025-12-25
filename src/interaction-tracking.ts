import { UnifiedTracking } from './unified-tracking';

/**
 * Configuration for unified interaction tracking
 */
export interface Config {
  logging?: boolean;
  scrollStopDelay?: number; // Delay after scroll stops before capturing (default: 150ms)
  maxBufferSize?: number; // Max mouse coordinates to buffer before forcing send (default: 10000)
  maxBatchTime?: number; // Max time before forcing batch send (default: 30000ms)
  screenshotQuality?: number;
}

/**
 * Initialize unified interaction tracking with scroll-based batching
 * - Waits for first user interaction (click/key/touch)
 * - Captures initial screenshot and sends immediately
 * - Buffers mouse movements client-side
 * - On scroll stop, sends batch with mouse data + new screenshot
 * - Ensures no data loss with dual-buffer pattern
 */
export function init(config: Config = {}): void {
  const logging = config.logging ?? false;

  // Initialize unified tracking with scroll-based behavior
  UnifiedTracking.init({
    scrollStopDelay: config.scrollStopDelay ?? 150, // Debounce delay after scroll stops
    maxBufferSize: config.maxBufferSize ?? 10000, // Safety: force send at 10k coordinates
    maxBatchTime: config.maxBatchTime ?? 30000, // Safety: force send after 30 seconds
    screenshotQuality: config.screenshotQuality ?? 0.92,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging,
  });

  if (logging) {
    console.log(
      '[InteractionTracking] Initialized with scroll-based tracking (captures screenshot on first interaction, then on each scroll stop with mouse data)'
    );
  }
}
