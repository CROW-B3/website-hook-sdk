import type { BaseEvent } from '../types';

type EventCallback = (event: BaseEvent) => void;

function getNavigationTiming(): Record<string, any> | null {
  if (!performance || !performance.timing) return null;

  const timing = performance.timing;
  const navigation = performance.navigation;

  return {
    navigationStart: timing.navigationStart,
    unloadEventStart: timing.unloadEventStart,
    unloadEventEnd: timing.unloadEventEnd,
    redirectStart: timing.redirectStart,
    redirectEnd: timing.redirectEnd,
    fetchStart: timing.fetchStart,
    domainLookupStart: timing.domainLookupStart,
    domainLookupEnd: timing.domainLookupEnd,
    connectStart: timing.connectStart,
    connectEnd: timing.connectEnd,
    secureConnectionStart: timing.secureConnectionStart,
    requestStart: timing.requestStart,
    responseStart: timing.responseStart,
    responseEnd: timing.responseEnd,
    domLoading: timing.domLoading,
    domInteractive: timing.domInteractive,
    domContentLoadedEventStart: timing.domContentLoadedEventStart,
    domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
    domComplete: timing.domComplete,
    loadEventStart: timing.loadEventStart,
    loadEventEnd: timing.loadEventEnd,
    navigationType: navigation?.type,
    redirectCount: navigation?.redirectCount,
    dnsTime: timing.domainLookupEnd - timing.domainLookupStart,
    tcpTime: timing.connectEnd - timing.connectStart,
    requestTime: timing.responseEnd - timing.requestStart,
    domProcessingTime: timing.domComplete - timing.domLoading,
    totalPageLoadTime: timing.loadEventEnd - timing.navigationStart,
  };
}

function getResourceTiming(): Array<Record<string, any>> {
  if (!performance || !performance.getEntriesByType) return [];

  const resources = performance.getEntriesByType('resource');
  return resources.slice(0, 50).map((resource: any) => ({
    name: resource.name,
    initiatorType: resource.initiatorType,
    duration: resource.duration,
    transferSize: resource.transferSize,
    encodedBodySize: resource.encodedBodySize,
    decodedBodySize: resource.decodedBodySize,
  }));
}

function getCoreWebVitals(): Record<string, any> {
  const vitals: Record<string, any> = {};

  if ('PerformanceObserver' in window) {
    try {
      const po = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            vitals.lcp = entry.startTime;
          }
          if (entry.entryType === 'first-input') {
            vitals.fid = (entry as any).processingStart - entry.startTime;
          }
          if (entry.name === 'first-contentful-paint') {
            vitals.fcp = entry.startTime;
          }
        }
      });

      po.observe({
        entryTypes: ['largest-contentful-paint', 'first-input', 'paint'],
      });
    } catch {
      // PerformanceObserver not supported or error occurred
    }
  }

  return vitals;
}

function createNavigationTimingEvent(): BaseEvent {
  return {
    type: 'performance_metric',
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      metricType: 'navigation_timing',
      ...getNavigationTiming(),
    },
  };
}

function createResourceTimingEvent(): BaseEvent {
  return {
    type: 'performance_metric',
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      metricType: 'resource_timing',
      resources: getResourceTiming(),
    },
  };
}

function createCoreWebVitalsEvent(): BaseEvent {
  return {
    type: 'performance_metric',
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      metricType: 'core_web_vitals',
      ...getCoreWebVitals(),
    },
  };
}

function setupNavigationTimingTracking(onEvent: EventCallback): () => void {
  const handler = () => {
    const event = createNavigationTimingEvent();
    onEvent(event);
  };

  if (document.readyState === 'complete') {
    handler();
  } else {
    window.addEventListener('load', handler);
    return () => window.removeEventListener('load', handler);
  }

  return () => {};
}

function setupCoreWebVitalsTracking(onEvent: EventCallback): () => void {
  if (!('PerformanceObserver' in window)) return () => {};

  try {
    const po = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (
          entry.entryType === 'largest-contentful-paint' ||
          entry.entryType === 'first-input' ||
          entry.name === 'first-contentful-paint'
        ) {
          const event = createCoreWebVitalsEvent();
          onEvent(event);
        }
      }
    });

    po.observe({
      entryTypes: ['largest-contentful-paint', 'first-input', 'paint'],
    });

    return () => po.disconnect();
  } catch {
    return () => {};
  }
}

export function setupPerformanceTracking(onEvent: EventCallback): () => void {
  const cleanupFunctions: Array<() => void> = [
    setupNavigationTimingTracking(onEvent),
    setupCoreWebVitalsTracking(onEvent),
  ];

  setTimeout(() => {
    const event = createResourceTimingEvent();
    onEvent(event);
  }, 2000);

  return () => {
    for (const cleanup of cleanupFunctions) {
      cleanup();
    }
  };
}
