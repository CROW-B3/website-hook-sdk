export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function extractSiteInfoFromUrl() {
  const hostname = window.location.hostname;
  const siteNameWithoutWww = hostname.replace(/^www\./, '');
  const siteName = siteNameWithoutWww.split('.')[0];
  return { hostname, siteName };
}

type ProcessEnvironment = {
  env?: Record<string, string | undefined>;
};

export function getEnvironmentVariable(key: string): string | undefined {
  const globalProcess = globalThis.process as ProcessEnvironment | undefined;

  if (!globalProcess?.env) return undefined;

  return globalProcess.env[key];
}

export function getCurrentEnvironmentName(): string {
  return getEnvironmentVariable('NODE_ENV') || 'production';
}
