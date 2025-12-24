/**
 * Backend URL constants used across the SDK
 * These point to the web-ingest-worker service
 */

import { getEnvVar } from './utils/environment';

/**
 * Base URL for the backend (web-ingest-worker)
 * Automatically overridden by NEXT_PUBLIC_BE_BASE_URL environment variable if set
 */
export const NEXT_BASE_URL =
  getEnvVar('NEXT_PUBLIC_BE_BASE_URL') || 'http://localhost:8787';

/** Endpoint path segments - centralized for easy refactoring */
export const ENDPOINT_PATHS = {
  /** Screenshot upload endpoint path */
  SCREENSHOTS: '/screenshots',
  /** Pointer data upload endpoint path */
  POINTER_DATA: '/pointer-data',
  /** Unified interaction data endpoint path (screenshots + pointer data) */
  UNIFIED_INTERACTION: '/interaction-batch',
} as const;

/** Full default screenshot upload URL */
export const DEFAULT_SCREENSHOT_UPLOAD_URL = `${NEXT_BASE_URL}${ENDPOINT_PATHS.SCREENSHOTS}`;

/** Full default pointer data upload URL */
export const DEFAULT_POINTER_DATA_UPLOAD_URL = `${NEXT_BASE_URL}${ENDPOINT_PATHS.POINTER_DATA}`;

/** Full default unified interaction upload URL */
export const DEFAULT_UNIFIED_INTERACTION_URL = `${NEXT_BASE_URL}${ENDPOINT_PATHS.UNIFIED_INTERACTION}`;
