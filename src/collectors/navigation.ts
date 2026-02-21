import type { Collector, CollectorContext } from './types';

function parseUtmParameters(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const utmParams: Record<string, string> = {};

  for (const key of utmKeys) {
    const value = params.get(key);
    if (value) {
      utmParams[key] = value;
    }
  }

  return utmParams;
}

export function createNavigationCollector(): Collector {
  let ctx: CollectorContext | null = null;
  let lastUrl = '';

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  function trackNavigation(fromUrl: string, toUrl: string): void {
    if (!ctx) return;

    const utmParams = parseUtmParameters();

    ctx.trackEvent('navigation', {
      from: fromUrl,
      to: toUrl,
      ...utmParams,
    });

    ctx.debug('Navigation tracked', { from: fromUrl, to: toUrl });
  }

  function handleUrlChange(): void {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      const previousUrl = lastUrl;
      lastUrl = currentUrl;
      trackNavigation(previousUrl, currentUrl);
    }
  }

  function patchedPushState(data: any, unused: string, url?: string | URL | null): void {
    originalPushState(data, unused, url);
    handleUrlChange();
  }

  function patchedReplaceState(data: any, unused: string, url?: string | URL | null): void {
    originalReplaceState(data, unused, url);
    handleUrlChange();
  }

  function handlePopState(): void {
    handleUrlChange();
  }

  return {
    name: 'navigation',

    initialize(context: CollectorContext): void {
      ctx = context;
      lastUrl = window.location.href;

      history.pushState = patchedPushState;
      history.replaceState = patchedReplaceState;
      window.addEventListener('popstate', handlePopState);

      const utmParams = parseUtmParameters();
      if (Object.keys(utmParams).length > 0) {
        ctx.trackEvent('navigation', {
          to: window.location.href,
          initial: true,
          ...utmParams,
        });
      }

      ctx.debug('Navigation collector initialized');
    },

    destroy(): void {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handlePopState);
      ctx = null;
    },
  };
}
