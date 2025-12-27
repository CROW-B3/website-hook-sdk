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
  getEnvVar('NEXT_PUBLIC_BE_BASE_URL') ||
  'https://crow-web-ingest-worker-dev.bitbybit-b3.workers.dev';
