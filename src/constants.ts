import { getEnvironmentVariable } from './utils/environment';

export const NEXT_BASE_URL =
  getEnvironmentVariable('NEXT_PUBLIC_BE_BASE_URL') || 'http://localhost:3001';
