import type { BaseEvent } from '../types';

type EventCallback = (event: BaseEvent) => void;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function captureScreenshot(): Promise<string | null> {
  if (!isBrowser()) return null;

  try {
    // Use html2canvas if available, otherwise use native canvas approach
    const html2canvas = (window as any).html2canvas;

    if (html2canvas) {
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: 0.5, // Reduce size for performance
        width: window.innerWidth,
        height: window.innerHeight,
      });
      return canvas.toDataURL('image/jpeg', 0.6); // Compress to JPEG at 60% quality
    }

    // Fallback: capture visible viewport using Canvas API if supported
    // This won't work for most cases but is a placeholder
    console.warn(
      '[CROW SDK] html2canvas not loaded, screenshot capture unavailable'
    );
    return null;
  } catch (error) {
    console.error('[CROW SDK] Screenshot capture failed:', error);
    return null;
  }
}

function createScreenshotEvent(imageData: string, trigger: string): BaseEvent {
  return {
    type: 'rrweb_snapshot' as const,
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      trigger,
      imageData,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
  };
}

export function setupScreenshotCapture(
  onEvent: EventCallback,
  options: {
    captureOnPageLoad?: boolean;
    captureOnClick?: boolean;
    captureInterval?: number; // ms, 0 = disabled
    maxScreenshotsPerSession?: number;
  } = {}
): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  const {
    captureOnPageLoad = true,
    captureOnClick = false,
    captureInterval = 0,
    maxScreenshotsPerSession = 10,
  } = options;

  let screenshotCount = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const cleanupFunctions: Array<() => void> = [];

  const takeScreenshot = async (trigger: string) => {
    if (screenshotCount >= maxScreenshotsPerSession) {
      return;
    }

    const imageData = await captureScreenshot();
    if (imageData) {
      screenshotCount++;
      const event = createScreenshotEvent(imageData, trigger);
      onEvent(event);
    }
  };

  // Capture on page load
  if (captureOnPageLoad) {
    if (document.readyState === 'complete') {
      setTimeout(() => takeScreenshot('page_load'), 1000); // Wait for render
    } else {
      const loadHandler = () => {
        setTimeout(() => takeScreenshot('page_load'), 1000);
      };
      window.addEventListener('load', loadHandler);
      cleanupFunctions.push(() =>
        window.removeEventListener('load', loadHandler)
      );
    }
  }

  // Capture on significant clicks (optional)
  if (captureOnClick) {
    const clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only capture for important elements
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a') ||
        target.getAttribute('role') === 'button'
      ) {
        setTimeout(() => takeScreenshot('click'), 500); // Wait for UI update
      }
    };
    document.addEventListener('click', clickHandler);
    cleanupFunctions.push(() =>
      document.removeEventListener('click', clickHandler)
    );
  }

  // Periodic capture (optional)
  if (captureInterval > 0) {
    intervalId = setInterval(() => {
      takeScreenshot('interval');
    }, captureInterval);
  }

  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    for (const cleanup of cleanupFunctions) {
      cleanup();
    }
  };
}

// Manual screenshot capture function exposed to SDK users
export async function captureManualScreenshot(
  onEvent: EventCallback,
  trigger: string = 'manual'
): Promise<boolean> {
  if (!isBrowser()) return false;

  const imageData = await captureScreenshot();
  if (imageData) {
    const event = createScreenshotEvent(imageData, trigger);
    onEvent(event);
    return true;
  }
  return false;
}
