import type { Collector, CollectorContext } from './types';

const WEB_VITAL_TYPES = ['largest-contentful-paint', 'first-input', 'layout-shift', 'paint'] as const;
const LONG_TASK_TYPE = 'longtask';

function mapVitalName(entryType: string, name?: string): string {
  switch (entryType) {
    case 'largest-contentful-paint': return 'LCP';
    case 'first-input': return 'FID';
    case 'layout-shift': return 'CLS';
    case 'paint':
      if (name === 'first-contentful-paint') return 'FCP';
      return name || entryType;
    default: return entryType;
  }
}

export function createPerformanceCollector(): Collector {
  let ctx: CollectorContext | null = null;
  let observers: PerformanceObserver[] = [];
  let originalFetch: typeof window.fetch | null = null;
  let clsValue = 0;

  function trackWebVital(name: string, value: number, entry?: PerformanceEntry): void {
    if (!ctx) return;

    ctx.trackEvent('web_vital', {
      name,
      value,
      rating: getRating(name, value),
      entryType: entry?.entryType,
    });
    ctx.debug('Web vital tracked', { name, value });
  }

  function getRating(name: string, value: number): string {
    switch (name) {
      case 'LCP':
        return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
      case 'FID':
        return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
      case 'CLS':
        return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
      case 'FCP':
        return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
      case 'TTFB':
        return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
      default:
        return 'unknown';
    }
  }

  function handleWebVitalEntry(type: string, entry: PerformanceEntry): void {
    if (type === 'layout-shift') {
      const layoutShiftEntry = entry as any;
      if (!layoutShiftEntry.hadRecentInput) {
        clsValue += layoutShiftEntry.value;
        trackWebVital('CLS', clsValue, entry);
      }
      return;
    }

    if (type === 'first-input') {
      const firstInputEntry = entry as any;
      trackWebVital('FID', firstInputEntry.processingStart - firstInputEntry.startTime, entry);
      return;
    }

    if (type === 'largest-contentful-paint') {
      trackWebVital('LCP', entry.startTime, entry);
      return;
    }

    if (type === 'paint') {
      trackWebVital(mapVitalName(type, entry.name), entry.startTime, entry);
    }
  }

  // Observes long-running tasks that may indicate performance issues
  function observeLongTasks(): void {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!ctx) return;
          ctx.trackEvent('performance', {
            subtype: 'long_task',
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
      longTaskObserver.observe({ type: LONG_TASK_TYPE, buffered: true });
      observers.push(longTaskObserver);
    } catch { }
  }

  function observeWebVitals(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    for (const type of WEB_VITAL_TYPES) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            handleWebVitalEntry(type, entry);
          }
        });
        observer.observe({ type, buffered: true });
        observers.push(observer);
      } catch { }
    }

    observeLongTasks();
  }

  function trackNavigationTiming(): void {
    if (!ctx) return;

    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (entries.length === 0) return;

    const nav = entries[0];
    const timing = {
      dns: nav.domainLookupEnd - nav.domainLookupStart,
      tcp: nav.connectEnd - nav.connectStart,
      ssl: nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0,
      ttfb: nav.responseStart - nav.requestStart,
      download: nav.responseEnd - nav.responseStart,
      domInteractive: nav.domInteractive - nav.fetchStart,
      domComplete: nav.domComplete - nav.fetchStart,
      loadEvent: nav.loadEventEnd - nav.loadEventStart,
      totalLoad: nav.loadEventEnd - nav.fetchStart,
    };

    ctx.trackEvent('performance', {
      subtype: 'page_load',
      ...timing,
    });

    trackWebVital('TTFB', timing.ttfb);
    ctx.debug('Navigation timing tracked', timing);
  }

  function monkeyPatchFetch(): void {
    originalFetch = window.fetch;

    window.fetch = async function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || 'GET';
      const startTime = Date.now();

      try {
        const response = await originalFetch!.call(window, input, init);

        if (response.status >= 400 && ctx) {
          ctx.trackEvent('api_error', {
            url,
            method,
            status: response.status,
            statusText: response.statusText,
            duration: Date.now() - startTime,
          });
          ctx.debug('API error detected', { url, status: response.status });
        }

        return response;
      } catch (error) {
        if (ctx) {
          ctx.trackEvent('api_error', {
            url,
            method,
            status: 0,
            error: error instanceof Error ? error.message : 'Network error',
            duration: Date.now() - startTime,
          });
        }
        throw error;
      }
    };
  }

  return {
    name: 'performance',

    initialize(context: CollectorContext): void {
      ctx = context;
      clsValue = 0;

      observeWebVitals();
      monkeyPatchFetch();

      if (document.readyState === 'complete') {
        trackNavigationTiming();
      } else {
        window.addEventListener('load', () => {
          setTimeout(trackNavigationTiming, 0);
        });
      }

      ctx.debug('Performance collector initialized');
    },

    destroy(): void {
      for (const observer of observers) {
        observer.disconnect();
      }
      observers = [];

      if (originalFetch) {
        window.fetch = originalFetch;
        originalFetch = null;
      }

      ctx = null;
    },
  };
}
