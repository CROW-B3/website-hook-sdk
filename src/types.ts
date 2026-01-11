/**
 * SDK Configuration options
 * Only projectId and debug are user-configurable.
 * All other settings are hardcoded internally.
 */
export interface CrowConfig {
  projectId: string; // API key for the project
  debug?: boolean; // Enable debug logging
}

/**
 * User information
 */
export interface User {
  id?: string; // Custom user ID
  anonymousId: string; // Auto-generated anonymous ID
  traits?: Record<string, any>; // User attributes
}

/**
 * Screen size
 */
export interface ScreenSize {
  width: number;
  height: number;
}

/**
 * Event types
 */
export type EventType = 'pageview' | 'click' | 'form' | 'custom' | 'error';

/**
 * Base event structure
 */
export interface BaseEvent {
  type: EventType;
  timestamp: number;
  url: string;
  referrer?: string;
  data?: Record<string, any>;
  userAgent?: string;
  screenSize?: ScreenSize;
}

/**
 * Context for session
 */
export interface SessionContext {
  url: string;
  referrer?: string;
  userAgent: string;
  screenSize: ScreenSize;
  timezone: string;
  locale: string;
}

/**
 * API Request/Response types
 */
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
