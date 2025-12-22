/**
 * @b3-crow/website-hook-sdk
 * A lightweight SDK for capturing user interactions and screenshots on web pages
 */

// Import and re-export namespaces
import { PointerTracking } from './pointer-tracking';
import { VisualTelemetry } from './visual-telemetry';
import * as InteractionTracking from './interaction-tracking';

// Export namespaces
export { PointerTracking, VisualTelemetry, InteractionTracking };

// Export convenience function for direct usage
export { init as initInteractionTracking } from './interaction-tracking';
