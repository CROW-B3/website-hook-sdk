/**
 * @b3-crow/website-hook-sdk
 * A lightweight SDK for capturing user interactions and screenshots on web pages
 */

// Import and re-export namespaces
import { PointerTracking } from './pointer-tracking';
import { VisualTelemetry } from './visual-telemetry';
import { UnifiedTracking } from './unified-tracking';
import * as InteractionTracking from './interaction-tracking';

// Export namespaces
// NOTE: PointerTracking and VisualTelemetry are legacy modules kept for backward compatibility
// New implementations should use UnifiedTracking or InteractionTracking
export {
  PointerTracking,
  VisualTelemetry,
  UnifiedTracking,
  InteractionTracking,
};

// Export convenience function for direct usage (recommended approach)
export { init as initInteractionTracking } from './interaction-tracking';

// Export shared utilities
export * as ScreenshotUtils from './utils/screenshot';
