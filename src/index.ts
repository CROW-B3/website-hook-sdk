import type { CrowSDK } from './sdk';
import { createCrowSDK } from './sdk';
import type { CrowConfig } from './types';

export type { CrowSDK };
export type * from './types';

let globalSdkInstance: CrowSDK | null = null;

function destroyPreviousInstanceIfExists(): void {
  if (!globalSdkInstance) return;

  console.warn('[Crow] SDK already initialized. Destroying previous instance.');
  globalSdkInstance.destroySdk();
}

export async function initializeCrow(userConfig: CrowConfig): Promise<CrowSDK> {
  destroyPreviousInstanceIfExists();

  globalSdkInstance = createCrowSDK(userConfig);
  await globalSdkInstance.initializeSdk();

  return globalSdkInstance;
}
