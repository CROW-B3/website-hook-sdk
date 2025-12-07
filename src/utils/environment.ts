/**
 * Shared utility functions used across multiple modules
 */

/**
 * Check if code is running in browser environment
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Extract site information from current URL
 */
export function getSiteInfo() {
  const hostname = window.location.hostname;
  const siteName = hostname.replace(/^www\./, '').split('.')[0];
  return { hostname, siteName };
}

/**
 * Get environment variable safely
 */
export function getEnvVar(key: string): string | undefined {
  // @ts-ignore - process.env may not exist in all environments
  if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
    // @ts-ignore
    return process.env[key];
  }
  return undefined;
}

/**
 * Get current environment name
 */
export function getEnvironment(): string {
  return getEnvVar('NODE_ENV') || 'production';
}
