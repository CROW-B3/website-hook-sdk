import type { ProductSnapshot } from '../types';
import type { Collector, CollectorContext } from './types';

let collectorCtx: CollectorContext | null = null;

export function captureProductSnapshot(snapshot: ProductSnapshot): void {
  if (!collectorCtx) {
    console.warn('[Crow] Context snapshot collector not initialized');
    return;
  }
  collectorCtx.trackEvent('context_snapshot', snapshot as unknown as Record<string, any>);
  collectorCtx.debug('Product snapshot captured', snapshot);
}

export function createContextSnapshotCollector(): Collector {
  return {
    name: 'context-snapshot',

    initialize(context: CollectorContext): void {
      collectorCtx = context;
      context.debug('Context snapshot collector initialized');
    },

    destroy(): void {
      collectorCtx = null;
    },
  };
}
