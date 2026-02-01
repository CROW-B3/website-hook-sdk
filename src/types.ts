export interface CrowConfig {
  apiKey: string;
  debug?: boolean;
}

export interface ScreenSize {
  width: number;
  height: number;
}

export type EventType = 'pageview' | 'click' | 'form' | 'custom' | 'error';

export interface BaseEvent {
  type: EventType;
  timestamp: number;
  url: string;
  referrer?: string;
  data?: Record<string, any>;
  userAgent?: string;
  screenSize?: ScreenSize;
}

export interface TrackRequest {
  sessionId: string;
  event: BaseEvent;
  apiKey: string;
}

export interface BatchRequest {
  sessionId: string;
  events: BaseEvent[];
  apiKey: string;
}

export interface ApiResponse {
  success: boolean;
  eventId?: string;
  errors?: string[] | any[];
}

export interface BatchResponse {
  success: boolean;
  processed?: number;
  failed?: number;
  errors?: Array<{ index: number; error: string }>;
}
