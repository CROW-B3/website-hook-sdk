import html2canvas from 'html2canvas-pro';

/**
 * Shared screenshot capture utilities
 * Used by both VisualTelemetry and UnifiedTracking
 */

export interface ViewportInfo {
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
}

export interface ScreenshotCaptureOptions {
  quality: number;
  useCORS: boolean;
  backgroundColor: string;
  logging: boolean;
}

export interface ScreenshotResult {
  blob: Blob;
  viewport: ViewportInfo;
  timestamp: number;
}

/**
 * Get current viewport information
 */
export function getViewportInfo(): ViewportInfo {
  return {
    scrollX: window.scrollX || window.pageXOffset || 0,
    scrollY: window.scrollY || window.pageYOffset || 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Convert canvas to blob
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      'image/png',
      quality
    );
  });
}

/**
 * Capture viewport screenshot
 * Shared utility for consistent screenshot capture
 */
export async function captureViewportScreenshot(
  options: ScreenshotCaptureOptions
): Promise<ScreenshotResult> {
  const timestamp = Date.now();
  const viewport = getViewportInfo();

  if (options.logging) {
    console.log('[Screenshot] Capturing viewport:', viewport);
  }

  const canvas = await html2canvas(document.documentElement, {
    useCORS: options.useCORS,
    allowTaint: false,
    backgroundColor: options.backgroundColor,
    scale: window.devicePixelRatio,
    logging: options.logging,
    x: viewport.scrollX,
    y: viewport.scrollY,
    width: viewport.width,
    height: viewport.height,
    windowWidth: viewport.width,
    windowHeight: viewport.height,
    scrollX: 0,
    scrollY: 0,
    ignoreElements: (element: Element) => {
      return element.tagName === 'SCRIPT';
    },
  });

  const blob = await canvasToBlob(canvas, options.quality);

  return {
    blob,
    viewport,
    timestamp,
  };
}

/**
 * Capture full page screenshot
 */
export async function captureFullPageScreenshot(
  options: ScreenshotCaptureOptions
): Promise<ScreenshotResult> {
  const timestamp = Date.now();
  const viewport = getViewportInfo();

  if (options.logging) {
    console.log('[Screenshot] Capturing full page');
  }

  const canvas = await html2canvas(document.body, {
    useCORS: options.useCORS,
    allowTaint: false,
    backgroundColor: options.backgroundColor,
    scale: window.devicePixelRatio,
    logging: options.logging,
    ignoreElements: (element: Element) => {
      return element.tagName === 'SCRIPT';
    },
  });

  const blob = await canvasToBlob(canvas, options.quality);

  return {
    blob,
    viewport,
    timestamp,
  };
}
