/**
 * @b3-crow/website-hook-sdk
 * A lightweight SDK for website tracking and analytics
 */

import { CrowSDK } from './sdk';
import type { CrowConfig } from './types';

// Export main SDK class
export { CrowSDK };

// Export types
export type * from './types';

// Global SDK instance
let globalInstance: CrowSDK | null = null;

/**
 * Initialize the Crow SDK
 * @param config - SDK configuration
 * @returns SDK instance
 */
export async function initCrow(config: CrowConfig): Promise<CrowSDK> {
  if (globalInstance) {
    console.warn(
      '[Crow] SDK already initialized. Destroying previous instance.'
    );
    globalInstance.destroy();
  }

  globalInstance = new CrowSDK(config);
  await globalInstance.init();

  // Make SDK available globally for debugging
  if (typeof window !== 'undefined') {
    (window as any).crow = globalInstance;
  }

  return globalInstance;
}

/**
 * Get the current SDK instance
 * @returns Current SDK instance or null
 */
export function getCrow(): CrowSDK | null {
  return globalInstance;
}

// Default export
export default {
  initCrow,
  getCrow,
  CrowSDK,
};
