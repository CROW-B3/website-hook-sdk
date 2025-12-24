import {
  isBrowserEnvironment,
  getSiteInfo,
  getEnvironment,
} from './utils/environment';
import { NEXT_BASE_URL, ENDPOINT_PATHS } from './constants';
import { BaseTracking } from './base-tracking';
import * as ScreenshotUtils from './utils/screenshot';

/**
 * @deprecated This module is kept for backward compatibility.
 * For new implementations, use UnifiedTracking instead which combines
 * screenshot and pointer tracking in a more efficient way.
 */
export namespace VisualTelemetry {
  /**
   * Viewport information
   * Re-exported from shared utilities for backward compatibility
   */
  export type ViewportInfo = ScreenshotUtils.ViewportInfo;

  /**
   * Capture metadata
   */
  export interface CaptureMetadata {
    site: string;
    hostname: string;
    environment: string;
    timestamp: number;
    userAgent: string;
    [key: string]: any;
  }

  /**
   * Configuration for auto-capture initialization
   */
  export interface Config {
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

  /**
   * Get current viewport information
   * Re-exported from shared utilities for backward compatibility
   */
  export const getViewportInfo = ScreenshotUtils.getViewportInfo;

  /**
   * Log viewport capture details
   */
  export function logViewportCapture(
    viewport: ViewportInfo,
    logging: boolean
  ): void {
    if (!logging) return;

    console.log(
      `${LOG_PREFIX} Capturing viewport at current scroll position:`,
      {
        scrollX: viewport.scrollX,
        scrollY: viewport.scrollY,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      }
    );
  }

  /**
   * Build capture metadata with site and environment info
   */
  export function buildMetadata(
    siteName: string,
    hostname: string,
    environment: string,
    customMetadata?: Record<string, any>
  ): CaptureMetadata {
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
   * Convert canvas to blob
   * Re-exported from shared utilities for backward compatibility
   */
  export const canvasToBlob = ScreenshotUtils.canvasToBlob;

  /**
   * Upload screenshot to server (fire-and-forget)
   */
  export function uploadScreenshot(
    blob: Blob,
    filename: string,
    uploadUrl: string,
    metadata: CaptureMetadata,
    logging: boolean
  ): void {
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

    BaseTracking.uploadFormData(formData, uploadUrl, {
      prefix: LOG_PREFIX,
      logging,
    });
  }

  /**
   * Capture viewport screenshot
   */
  export async function captureViewport(
    config: ReturnType<typeof buildFinalConfig>,
    siteName: string,
    metadata: CaptureMetadata
  ): Promise<void> {
    const result = await ScreenshotUtils.captureViewportScreenshot({
      quality: config.quality,
      useCORS: config.useCORS,
      backgroundColor: config.backgroundColor,
      logging: config.logging,
    });

    logViewportCapture(result.viewport, config.logging);

    const filename = `${siteName}-screenshot-${result.timestamp}.png`;
    const captureMetadata = {
      ...metadata,
      timestamp: result.timestamp,
    };

    // Fire and forget upload
    uploadScreenshot(
      result.blob,
      filename,
      config.uploadUrl,
      captureMetadata,
      config.logging
    );
  }

  /**
   * Capture full page screenshot
   */
  export async function captureFullPage(
    config: ReturnType<typeof buildFinalConfig>,
    siteName: string,
    metadata: CaptureMetadata
  ): Promise<void> {
    const result = await ScreenshotUtils.captureFullPageScreenshot({
      quality: config.quality,
      useCORS: config.useCORS,
      backgroundColor: config.backgroundColor,
      logging: config.logging,
    });

    const filename = `${siteName}-screenshot-${result.timestamp}.png`;
    const captureMetadata = {
      ...metadata,
      timestamp: result.timestamp,
    };

    // Fire and forget upload
    uploadScreenshot(
      result.blob,
      filename,
      config.uploadUrl,
      captureMetadata,
      config.logging
    );
  }

  /**
   * Main screenshot capture handler
   */
  export async function captureScreenshot(
    config: ReturnType<typeof buildFinalConfig>,
    siteName: string,
    defaultMetadata: CaptureMetadata
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

  const DEFAULT_INTERVAL_MS = 300;
  const DEFAULT_QUALITY = 0.92;
  const DEFAULT_BACKGROUND_COLOR = '#ffffff';
  const LOG_PREFIX = '[VisualTelemetry]';

  let isInitialized = false;

  /**
   * Build upload URL from environment or config
   */
  function buildUploadUrl(configUrl?: string): string {
    if (configUrl) return configUrl;

    return `${NEXT_BASE_URL}${ENDPOINT_PATHS.SCREENSHOTS}`;
  }

  /**
   * Build final configuration with defaults
   */
  function buildFinalConfig(
    config: Config,
    siteName: string,
    defaultMetadata: CaptureMetadata
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
   * Initialize periodic screenshot auto-capture
   */
  export function init(config: Config = {}): void {
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
        console.log(
          `${LOG_PREFIX} Screenshot capture DISABLED (interval: null)`
        );
      }
    }
  }
}
