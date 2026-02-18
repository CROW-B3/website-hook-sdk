import type { Collector, CollectorContext } from './types';

const SCROLL_DEBOUNCE_MS = 250;
const SCROLL_THRESHOLDS = [25, 50, 75, 90, 100];
const RESIZE_DEBOUNCE_MS = 250;

export function createEngagementCollector(): Collector {
  let ctx: CollectorContext | null = null;
  let scrollHandler: (() => void) | null = null;
  let visibilityHandler: (() => void) | null = null;
  let resizeHandler: (() => void) | null = null;
  let scrollDebounceTimer: number | null = null;
  let resizeDebounceTimer: number | null = null;
  let reachedThresholds: Set<number> = new Set();
  let pageEntryTime: number = 0;
  let lastVisibilityChangeTime: number = 0;

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

  function handleVisibilityChange(): void {
    if (!ctx) return;

    const now = Date.now();
    const isVisible = document.visibilityState === 'visible';

    ctx.trackEvent('visibility', {
      visible: isVisible,
      timestamp: now,
      pageEntryTime,
      timeSinceLastChange: lastVisibilityChangeTime > 0 ? now - lastVisibilityChangeTime : 0,
    });

    lastVisibilityChangeTime = now;
    ctx.debug('Visibility changed', { visible: isVisible });
  }

  function handleResize(): void {
    if (resizeDebounceTimer !== null) {
      window.clearTimeout(resizeDebounceTimer);
    }

    resizeDebounceTimer = window.setTimeout(() => {
      if (!ctx) return;

      ctx.trackEvent('engagement', {
        subtype: 'resize',
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        timestamp: Date.now(),
      });
    }, RESIZE_DEBOUNCE_MS);
  }

  return {
    name: 'engagement',

    initialize(context: CollectorContext): void {
      ctx = context;
      pageEntryTime = Date.now();
      lastVisibilityChangeTime = Date.now();
      reachedThresholds = new Set();

      scrollHandler = handleScroll;
      visibilityHandler = handleVisibilityChange;
      resizeHandler = handleResize;

      window.addEventListener('scroll', scrollHandler, { passive: true });
      document.addEventListener('visibilitychange', visibilityHandler);
      window.addEventListener('resize', resizeHandler, { passive: true });

      ctx.trackEvent('engagement', {
        subtype: 'page_entry',
        timestamp: pageEntryTime,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      });

      ctx.debug('Engagement collector initialized');
    },

    destroy(): void {
      if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler);
      }
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (scrollDebounceTimer !== null) {
        window.clearTimeout(scrollDebounceTimer);
      }
      if (resizeDebounceTimer !== null) {
        window.clearTimeout(resizeDebounceTimer);
      }

      if (ctx) {
        ctx.trackEvent('engagement', {
          subtype: 'page_exit',
          timestamp: Date.now(),
          pageEntryTime,
          totalTimeOnPage: Date.now() - pageEntryTime,
          maxScrollDepth: Math.max(0, ...reachedThresholds),
        });
      }

      ctx = null;
    },
  };
}
