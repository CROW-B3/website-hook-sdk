export interface CrowConfig {
  apiKey?: string;
  projectId?: string;
  ingestUrl?: string;
  debug?: boolean;
  capture?: Partial<CaptureConfig>;
}

export interface CaptureConfig {
  pageViews: boolean;
  clicks: boolean;
  errors: boolean;
  navigation: boolean;
  engagement: boolean;
  interactions: boolean;
  performance: boolean;
  replay: boolean;
  sendAnalyticsEvents?: boolean;
}

export interface ScreenSize {
  width: number;
  height: number;
}

export type EventType =
  | 'pageview'
  | 'click'
  | 'form'
  | 'custom'
  | 'error'
  | 'navigation'
  | 'scroll'
  | 'rage_click'
  | 'add_to_cart'
  | 'variant_select'
  | 'image_zoom'
  | 'performance'
  | 'web_vital'
  | 'api_error'
  | 'clipboard_copy'
  | 'clipboard_paste'
  | 'visibility_change'
  | 'media_play'
  | 'media_pause'
  | 'download'
  | 'form_focus'
  | 'form_blur'
  | 'form_input'
  | 'form_validation'
  | 'mousemove'
  | 'network_request'
  | 'performance_metric'
  | 'rrweb_snapshot'
  | 'rrweb_incremental';

export interface BaseEvent {
  type: EventType;
  timestamp: number;
  url: string;
  referrer?: string;
  data?: Record<string, any>;
  userAgent?: string;
  screenSize?: ScreenSize;
}

export interface SessionContext {
  url: string;
  referrer?: string;
  userAgent: string;
  screenSize: ScreenSize;
  timezone: string;
  locale: string;
}

export interface UtmParameters {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export interface ReplayBatchRequest {
  sessionId: string;
  chunkIndex: number;
  events: any[];
  timestamp: number;
}

export interface ReplayBatchResponse {
  success: boolean;
  chunkId?: string;
}

export interface TrackRequest {
  sessionId: string;
  event: BaseEvent;
}

export interface BatchRequest {
  sessionId: string;
  events: BaseEvent[];
}

export interface SessionStartRequest {
  sessionId: string;
  projectId?: string;
  context: SessionContext;
}

export type ExitTriggerType = 'tab_close' | 'navigation_away' | 'idle_timeout';

export interface ExitContext {
  lastPageUrl: string;
  lastPageTitle: string;
  lastPageTimeSpentMs: number;
  exitTrigger: ExitTriggerType;
  hadCartItems: boolean;
  lastInteractions: Array<{
    type: string;
    timestamp: number;
    description: string;
  }>;
  totalSessionDurationMs: number;
}

export interface SessionEndRequest {
  sessionId: string;
  duration: number;
  pageViews: number;
  interactions: number;
  exitContext?: ExitContext;
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

export interface SessionResponse {
  success: boolean;
  sessionId?: string;
  expiresAt?: number;
}
