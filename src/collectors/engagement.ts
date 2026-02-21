import type { Collector, CollectorContext } from './types';

const SCROLL_DEBOUNCE_MS = 250;
const SCROLL_THRESHOLDS = [25, 50, 75, 90, 100];

export function createEngagementCollector(): Collector {
  let ctx: CollectorContext | null = null;
  let scrollHandler: (() => void) | null = null;
  let scrollDebounceTimer: number | null = null;
  let reachedThresholds: Set<number> = new Set();

  function calculateScrollDepth(): number {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const maxScroll = scrollHeight - clientHeight;

    if (maxScroll <= 0) return 100;
    return Math.min(100, Math.round((scrollTop / maxScroll) * 100));
  }

  function handleScroll(): void {
    if (scrollDebounceTimer !== null) {
      window.clearTimeout(scrollDebounceTimer);
    }

    scrollDebounceTimer = window.setTimeout(() => {
      if (!ctx) return;

      const depth = calculateScrollDepth();

      for (const threshold of SCROLL_THRESHOLDS) {
        if (depth >= threshold && !reachedThresholds.has(threshold)) {
          reachedThresholds.add(threshold);
          ctx.trackEvent('scroll', {
            depth: threshold,
            actualDepth: depth,
            timestamp: Date.now(),
          });
          ctx.debug('Scroll threshold reached', { threshold, depth });
        }
      }
    }, SCROLL_DEBOUNCE_MS);
  }

  return {
    name: 'engagement',

    initialize(context: CollectorContext): void {
      ctx = context;
      reachedThresholds = new Set();

      scrollHandler = handleScroll;

      window.addEventListener('scroll', scrollHandler, { passive: true });

      ctx.debug('Engagement collector initialized');
    },

    destroy(): void {
      if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler);
      }
      if (scrollDebounceTimer !== null) {
        window.clearTimeout(scrollDebounceTimer);
      }

      ctx = null;
    },
  };
}
