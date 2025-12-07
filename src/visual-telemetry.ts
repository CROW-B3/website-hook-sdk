import html2canvas from 'html2canvas-pro';
import {
  isBrowserEnvironment,
  getSiteInfo,
  getEnvVar,
  getEnvironment,
} from './utils/environment';

/** Auto-capture configuration */
export interface AutoCaptureConfig {
  interval?: number | null;
  filename?: string;
  viewportOnly?: boolean;
  uploadUrl?: string;
  uploadMetadata?: Record<string, any>;
  useCORS?: boolean;
  backgroundColor?: string;
  scale?: number;
  quality?: number;
  logging?: boolean;
}

// Constants
const DEFAULT_INTERVAL_MS = 300;
const DEFAULT_UPLOAD_URL = 'http://localhost:3001/screenshot';
const DEFAULT_QUALITY = 0.92;
const DEFAULT_BACKGROUND_COLOR = '#ffffff';
const LOG_PREFIX = '[VisualTelemetry]';

let isInitialized = false;

/**
 * Build upload URL from environment or config
 */
function buildUploadUrl(configUrl?: string): string {
  const envUploadUrl = getEnvVar('NEXT_PUBLIC_SCREENSHOT_UPLOAD_URL');
  return configUrl ?? envUploadUrl ?? DEFAULT_UPLOAD_URL;
}

/**
 * Build capture metadata with site and environment info
 */
function buildMetadata(
  siteName: string,
  hostname: string,
  environment: string,
  customMetadata?: Record<string, any>
): Record<string, any> {
  return {
    site: siteName,
    hostname: hostname,
    environment: environment,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    ...customMetadata,
  };
}

/**
 * Build final configuration with defaults
 */
function buildFinalConfig(
  config: AutoCaptureConfig,
  siteName: string,
  defaultMetadata: Record<string, any>
) {
  return {
    interval: config.interval ?? DEFAULT_INTERVAL_MS,
    filename: config.filename ?? `${siteName}-screenshot-${Date.now()}`,
    viewportOnly: config.viewportOnly ?? true,
    uploadUrl: buildUploadUrl(config.uploadUrl),
    uploadMetadata: defaultMetadata,
    useCORS: config.useCORS ?? true,
    backgroundColor: config.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    scale: config.scale ?? window.devicePixelRatio,
    quality: config.quality ?? DEFAULT_QUALITY,
    logging: config.logging ?? false,
  };
}

/**
 * Convert canvas to blob
 */
async function canvasToBlob(
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
 * Get current viewport information
 */
function getViewportInfo() {
  return {
    scrollX: window.scrollX || window.pageXOffset || 0,
    scrollY: window.scrollY || window.pageYOffset || 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Log viewport capture details
 */
function logViewportCapture(
  viewport: ReturnType<typeof getViewportInfo>,
  logging: boolean
): void {
  if (!logging) return;

  console.log(`${LOG_PREFIX} Capturing viewport at current scroll position:`, {
    scrollX: viewport.scrollX,
    scrollY: viewport.scrollY,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });
}

/**
 * Log upload attempt
 */
function logUploadAttempt(uploadUrl: string, logging: boolean): void {
  if (!logging) return;
  console.log(`${LOG_PREFIX} Uploading screenshot to:`, uploadUrl);
}

/**
 * Log upload success
 */
function logUploadSuccess(
  status: number,
  blobSize: number,
  logging: boolean
): void {
  if (!logging) return;
  console.log(`${LOG_PREFIX} Screenshot uploaded successfully!`, {
    status: status,
    size: `${(blobSize / 1024).toFixed(2)} KB`,
  });
}

/**
 * Upload screenshot to server
 */
async function uploadScreenshot(
  blob: Blob,
  filename: string,
  uploadUrl: string,
  metadata: Record<string, any>,
  logging: boolean
): Promise<boolean> {
  try {
    logUploadAttempt(uploadUrl, logging);

    const formData = new FormData();
    formData.append('screenshot', blob, filename);
    formData.append('filename', filename);
    formData.append('timestamp', Date.now().toString());
    formData.append('url', window.location.href);
    formData.append('userAgent', navigator.userAgent);

    const viewport = getViewportInfo();
    formData.append('viewport', JSON.stringify(viewport));

    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      );
    });

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        `Upload failed: ${response.status} ${response.statusText}`
      );
    }

    logUploadSuccess(response.status, blob.size, logging);
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to upload screenshot:`, error);
    return false;
  }
}

/**
 * Capture viewport screenshot
 */
async function captureViewport(
  config: ReturnType<typeof buildFinalConfig>,
  siteName: string,
  metadata: Record<string, any>
): Promise<void> {
  const timestamp = Date.now();
  const filenameBase = `${siteName}-screenshot-${timestamp}`;

  const captureMetadata = {
    ...metadata,
    timestamp,
  };

  const viewport = getViewportInfo();
  logViewportCapture(viewport, config.logging);

  const canvas = await html2canvas(document.documentElement, {
    useCORS: config.useCORS,
    allowTaint: false,
    backgroundColor: config.backgroundColor,
    scale: config.scale,
    logging: config.logging,
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

  if (config.logging) {
    console.log(`${LOG_PREFIX} Screenshot captured, converting to blob...`);
  }

  const blob = await canvasToBlob(canvas, config.quality);
  const filename = `${filenameBase}.png`;

  const uploadSuccess = await uploadScreenshot(
    blob,
    filename,
    config.uploadUrl,
    captureMetadata,
    config.logging
  );

  if (!uploadSuccess) {
    console.error(
      `${LOG_PREFIX} Upload failed. Continuing with next capture...`
    );
  }
}

/**
 * Capture full page screenshot
 */
async function captureFullPage(
  config: ReturnType<typeof buildFinalConfig>,
  siteName: string,
  metadata: Record<string, any>
): Promise<void> {
  const timestamp = Date.now();
  const filenameBase = `${siteName}-screenshot-${timestamp}`;

  const captureMetadata = {
    ...metadata,
    timestamp,
  };

  if (config.logging) {
    console.log(`${LOG_PREFIX} Capturing full page`);
  }

  const canvas = await html2canvas(document.body, {
    useCORS: config.useCORS,
    allowTaint: false,
    backgroundColor: config.backgroundColor,
    scale: config.scale,
    logging: config.logging,
    ignoreElements: (element: Element) => {
      return element.tagName === 'SCRIPT';
    },
  });

  if (config.logging) {
    console.log(`${LOG_PREFIX} Screenshot captured, converting to blob...`);
  }

  const blob = await canvasToBlob(canvas, config.quality);
  const filename = `${filenameBase}.png`;

  const uploadSuccess = await uploadScreenshot(
    blob,
    filename,
    config.uploadUrl,
    captureMetadata,
    config.logging
  );

  if (!uploadSuccess) {
    console.error(
      `${LOG_PREFIX} Upload failed. Continuing with next capture...`
    );
  }
}

/**
 * Main screenshot capture handler
 */
async function captureScreenshot(
  config: ReturnType<typeof buildFinalConfig>,
  siteName: string,
  defaultMetadata: Record<string, any>
): Promise<void> {
  try {
    if (config.viewportOnly) {
      await captureViewport(config, siteName, defaultMetadata);
    } else {
      await captureFullPage(config, siteName, defaultMetadata);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to capture screenshot:`, error);
  }
}

/**
 * Initializes periodic screenshot auto-capture
 * Note: For pointer tracking, use initPointerTracking instead
 */
export function initAutoCapture(config: AutoCaptureConfig = {}): void {
  if (isInitialized) {
    if (config.logging) {
      console.warn(`${LOG_PREFIX} Already initialized. Skipping...`);
    }
    return;
  }

  if (!isBrowserEnvironment()) {
    console.error(`${LOG_PREFIX} Must be run in browser environment`);
    return;
  }

  isInitialized = true;

  // Extract site information
  const { hostname, siteName } = getSiteInfo();
  const environment = getEnvironment();

  // Build metadata
  const defaultMetadata = buildMetadata(
    siteName,
    hostname,
    environment,
    config.uploadMetadata
  );

  // Build final configuration
  const finalConfig = buildFinalConfig(config, siteName, defaultMetadata);

  // Warn if no upload URL is provided
  if (!finalConfig.uploadUrl) {
    console.warn(
      `${LOG_PREFIX} No uploadUrl provided. Screenshots will not be captured or uploaded. Please provide an uploadUrl in the configuration.`
    );
    return;
  }

  if (finalConfig.logging) {
    console.log(`${LOG_PREFIX} Initialized with config:`, finalConfig);
  }

  // Start interval-based capture if enabled
  if (finalConfig.interval && finalConfig.interval > 0) {
    if (finalConfig.logging) {
      console.log(`${LOG_PREFIX} Capturing first screenshot immediately...`);
    }
    captureScreenshot(finalConfig, siteName, defaultMetadata);

    if (finalConfig.logging) {
      console.log(
        `${LOG_PREFIX} Setting up continuous screenshot capture every ${finalConfig.interval}ms`
      );
    }

    setInterval(() => {
      captureScreenshot(finalConfig, siteName, defaultMetadata);
    }, finalConfig.interval);
  } else {
    if (finalConfig.logging) {
      console.log(`${LOG_PREFIX} Screenshot capture DISABLED (interval: null)`);
    }
  }
}
