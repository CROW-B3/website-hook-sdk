import type { BaseEvent } from '../types';

const MOUSEMOVE_THROTTLE_MS = 100;
const SCROLL_DEBOUNCE_MS = 150;

type MouseScrollConfig = {
  enableMousemove: boolean;
  enableScroll: boolean;
};

type EventCallback = (event: BaseEvent) => void;

function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T {
  let lastCall = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  }) as T;
}

function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

function createMousemoveEvent(mouseEvent: MouseEvent): BaseEvent {
  return {
    type: 'mousemove',
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
      pageX: mouseEvent.pageX,
      pageY: mouseEvent.pageY,
    },
  } as BaseEvent;
}

function createScrollEvent(): BaseEvent {
  return {
    type: 'scroll',
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      scrollTop: window.scrollY || document.documentElement.scrollTop,
      scrollLeft: window.scrollX || document.documentElement.scrollLeft,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollPercentageY: (
        ((window.scrollY || document.documentElement.scrollTop) /
          (document.documentElement.scrollHeight -
            document.documentElement.clientHeight)) *
        100
      ).toFixed(2),
    },
  };
}

function setupMousemoveTracking(onEvent: EventCallback): () => void {
  const throttledHandler = throttle((mouseEvent: MouseEvent) => {
    const event = createMousemoveEvent(mouseEvent);
    onEvent(event);
  }, MOUSEMOVE_THROTTLE_MS);

  document.addEventListener('mousemove', throttledHandler);

  return () => document.removeEventListener('mousemove', throttledHandler);
}

function setupScrollTracking(onEvent: EventCallback): () => void {
  const debouncedHandler = debounce(() => {
    const event = createScrollEvent();
    onEvent(event);
  }, SCROLL_DEBOUNCE_MS);

  window.addEventListener('scroll', debouncedHandler, { passive: true });

  return () => window.removeEventListener('scroll', debouncedHandler);
}

export function setupMouseScrollTracking(
  config: MouseScrollConfig,
  onEvent: EventCallback
): () => void {
  const cleanupFunctions: Array<() => void> = [];

  if (config.enableMousemove) {
    cleanupFunctions.push(setupMousemoveTracking(onEvent));
  }

  if (config.enableScroll) {
    cleanupFunctions.push(setupScrollTracking(onEvent));
  }

  return () => {
    for (const cleanup of cleanupFunctions) {
      cleanup();
    }
  };
}
