import html2canvas from 'html2canvas-pro';
import ky from 'ky';
import {
  isBrowserEnvironment,
  getSiteInfo,
  getEnvVar,
  getEnvironment,
} from './utils/environment';
import { NEXT_BASE_URL, ENDPOINT_PATHS } from './utils/constants';

export namespace VisualTelemetry {
  /**
   * Viewport namespace - groups viewport interface and related utilities
   */
  export namespace Viewport {
    /**
     * Viewport information
     */
    export interface Info {
      scrollX: number;
      scrollY: number;
      width: number;
      height: number;
    }

    /**
     * Get current viewport information
     */
    export function getInfo(): Info {
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
    export function logCapture(viewport: Info, logging: boolean): void {
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
  }

  /**
   * Metadata namespace - groups metadata interface and related utilities
   */
  export namespace Metadata {
    /**
     * Capture metadata
     */
    export interface Data {
      site: string;
      hostname: string;
      environment: string;
      timestamp: number;
      userAgent: string;
      [key: string]: any;
    }

    /**
     * Build capture metadata with site and environment info
     */
    export function build(
      siteName: string,
      hostname: string,
      environment: string,
      customMetadata?: Record<string, any>
    ): Data {
      return {
        site: siteName,
        hostname: hostname,
        environment: environment,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        ...customMetadata,
      };
    }
  }

  /**
   * Screenshot namespace - groups screenshot capture and upload utilities
   */
  export namespace Screenshot {
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
     * Log upload attempt
     */
    export function logUploadAttempt(
      uploadUrl: string,
      logging: boolean
    ): void {
      if (!logging) return;
      console.log(`${LOG_PREFIX} Uploading screenshot to:`, uploadUrl);
    }

    /**
     * Upload screenshot to server (fire-and-forget)
     */
    export function upload(
      blob: Blob,
      filename: string,
      uploadUrl: string,
      metadata: Metadata.Data,
      logging: boolean
    ): void {
      logUploadAttempt(uploadUrl, logging);

      const formData = new FormData();
      formData.append('screenshot', blob, filename);
      formData.append('filename', filename);
      formData.append('timestamp', Date.now().toString());
      formData.append('url', window.location.href);
      formData.append('userAgent', navigator.userAgent);

      const viewport = Viewport.getInfo();
      formData.append('viewport', JSON.stringify(viewport));

      Object.entries(metadata).forEach(([key, value]) => {
        formData.append(
          key,
          typeof value === 'string' ? value : JSON.stringify(value)
        );
      });

      // Fire and forget - send data without waiting for response
      ky.post(uploadUrl, {
        body: formData,
      }).catch(error => {
        console.error(`${LOG_PREFIX} Failed to upload screenshot:`, error);
      });
    }

    /**
     * Capture viewport screenshot
     */
    export async function captureViewport(
      config: ReturnType<typeof buildFinalConfig>,
      siteName: string,
      metadata: Metadata.Data
    ): Promise<void> {
      const timestamp = Date.now();
      const filenameBase = `${siteName}-screenshot-${timestamp}`;

      const captureMetadata = {
        ...metadata,
        timestamp,
      };

      const viewport = Viewport.getInfo();
      Viewport.logCapture(viewport, config.logging);

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

      // Fire and forget upload
      upload(blob, filename, config.uploadUrl, captureMetadata, config.logging);
    }

    /**
     * Capture full page screenshot
     */
    export async function captureFullPage(
      config: ReturnType<typeof buildFinalConfig>,
      siteName: string,
      metadata: Metadata.Data
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

      // Fire and forget upload
      upload(blob, filename, config.uploadUrl, captureMetadata, config.logging);
    }

    /**
     * Main screenshot capture handler
     */
    export async function capture(
      config: ReturnType<typeof buildFinalConfig>,
      siteName: string,
      defaultMetadata: Metadata.Data
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

    const envBaseUrl = getEnvVar('NEXT_PUBLIC_BE_BASE_URL');
    const baseUrl = envBaseUrl || NEXT_BASE_URL;
    return `${baseUrl}${ENDPOINT_PATHS.SCREENSHOTS}`;
  }

  /**
   * Build final configuration with defaults
   */
  function buildFinalConfig(
    config: Config,
    siteName: string,
    defaultMetadata: Metadata.Data
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
    const defaultMetadata = Metadata.build(
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
      Screenshot.capture(finalConfig, siteName, defaultMetadata);

      if (finalConfig.logging) {
        console.log(
          `${LOG_PREFIX} Setting up continuous screenshot capture every ${finalConfig.interval}ms`
        );
      }

      setInterval(() => {
        Screenshot.capture(finalConfig, siteName, defaultMetadata);
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
