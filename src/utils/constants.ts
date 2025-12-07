/**
 * Upload URL constants used across the SDK
 */

/** Base upload URL for all endpoints */
export const DEFAULT_BASE_UPLOAD_URL = 'http://localhost:3001';

/** Screenshot upload endpoint */
export const SCREENSHOT_ENDPOINT = '/screenshot';

/** Pointer data upload endpoint */
export const POINTER_DATA_ENDPOINT = '/pointer-data';

/** Full default screenshot upload URL */
export const DEFAULT_SCREENSHOT_UPLOAD_URL = `${DEFAULT_BASE_UPLOAD_URL}${SCREENSHOT_ENDPOINT}`;

/** Full default pointer data upload URL */
export const DEFAULT_POINTER_DATA_UPLOAD_URL = `${DEFAULT_BASE_UPLOAD_URL}${POINTER_DATA_ENDPOINT}`;
