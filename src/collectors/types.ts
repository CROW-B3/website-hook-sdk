import type { CaptureConfig, EventType } from '../types';
import type { ApiClient } from '../api/client';

export interface CollectorContext {
  trackEvent: (eventType: EventType, data?: Record<string, any>) => void;
  config: CaptureConfig;
  sessionId: string;
  apiClient: ApiClient;
  debug: (message: string, data?: any) => void;
}

export interface Collector {
  name: string;
  initialize: (ctx: CollectorContext) => void;
  destroy: () => void;
}
