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
