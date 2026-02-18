export interface CrowConfig {
  projectId: string;
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
}

export interface User {
  id?: string;
  anonymousId: string;
  traits?: Record<string, any>;
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
  | 'engagement'
  | 'scroll'
  | 'visibility'
  | 'rage_click'
  | 'hover'
  | 'form_focus'
  | 'add_to_cart'
  | 'variant_select'
  | 'image_zoom'
  | 'context_snapshot'
  | 'performance'
  | 'web_vital'
  | 'api_error';

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

export interface ProductSnapshot {
  productId: string;
  price?: number;
  availability?: string;
  shippingEstimate?: string;
  variants?: Record<string, any>[];
  promotions?: string[];
  outOfStock?: boolean;
}

export interface ReplayBatchRequest {
  projectId: string;
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
  projectId: string;
  sessionId: string;
  event: BaseEvent;
  user?: User;
}

export interface BatchRequest {
  projectId: string;
  sessionId: string;
  events: BaseEvent[];
  user?: User;
}

export interface SessionStartRequest {
  projectId: string;
  sessionId: string;
  user: User;
  context: SessionContext;
}

export interface SessionEndRequest {
  projectId: string;
  sessionId: string;
  duration: number;
  pageViews: number;
  interactions: number;
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
