import { getEnvironmentVariable } from './utils/environment';

export const NEXT_BASE_URL =
  getEnvironmentVariable('NEXT_PUBLIC_BE_BASE_URL') || 'https://dev.internal.ingest-worker.crowai.dev';
