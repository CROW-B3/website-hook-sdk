import type {
  BaseEvent,
  CaptureConfig,
  CrowConfig,
  EventType,
  ExitContext,
  ExitTriggerType,
  ProductSnapshot,
  ScreenSize,
  SessionContext,
  User,
} from './types';
import type { ApiClient } from './api/client';
import type { EventQueue } from './utils/queue';
import type { Collector, CollectorContext } from './collectors/types';
import type {
  AddToCartData,
  ImageZoomData,
  VariantSelectData,
} from './collectors/ecommerce';
import { createApiClient } from './api/client';
import {
  extendCurrentSessionExpiry,
  getOrCreateAnonymousId,
  getOrCreateSessionId,
} from './utils/id';
import { createEventQueue } from './utils/queue';
import { isBrowserEnvironment } from './utils/environment';
import { NEXT_BASE_URL } from './constants';
import { createNavigationCollector } from './collectors/navigation';
import { createEngagementCollector } from './collectors/engagement';
import { createInteractionCollector } from './collectors/interaction';
import {
  createEcommerceCollector,
  trackAddToCart as ecommerceTrackAddToCart,
  trackVariantSelect as ecommerceTrackVariantSelect,
  trackImageZoom as ecommerceTrackImageZoom,
} from './collectors/ecommerce';
import {
  createContextSnapshotCollector,
  captureProductSnapshot as contextCaptureSnapshot,
} from './collectors/context-snapshot';
import { createPerformanceCollector } from './collectors/performance';
import { createErrorCollector } from './collectors/error';
import { createReplayCollector } from './collectors/replay';
import { createAutoContextCollector } from './collectors/auto-context';

const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  pageViews: true,
  clicks: true,
  errors: true,
  navigation: true,
  engagement: true,
  interactions: true,
  performance: true,
  replay: true,
  autoContext: true,
  sendAnalyticsEvents: false,
};

const DEFAULT_BATCHING_CONFIG = {
  enabled: true,
  maxBatchSize: 10,
  flushInterval: 5000,
} as const;

type InternalConfig = {
  projectId: string;
  apiEndpoint: string;
  capture: CaptureConfig;
  batching: {
    enabled: boolean;
    maxBatchSize: number;
    flushInterval: number;
  };
  debug: boolean;
};

const MAX_RECENT_INTERACTIONS = 10;

interface RecentInteraction {
  type: string;
  timestamp: number;
  url: string;
  description: string;
}

type SdkState = {
  config: InternalConfig;
  apiClient: ApiClient;
  sessionId: string;
  anonymousId: string;
  user: User;
  eventQueue: EventQueue | null;
  sessionStartTime: number;
  pageViewCount: number;
  interactionCount: number;
  isInitialized: boolean;
  collectors: Collector[];
  lastPageUrl: string;
  lastPageTitle: string;
  lastPageEntryTime: number;
  hadCartItems: boolean;
  recentInteractions: RecentInteraction[];
};

export type CrowSDK = {
  initializeSdk: () => Promise<void>;
  trackEvent: (eventType: EventType, data?: Record<string, any>) => void;
  trackPageView: (data?: Record<string, any>) => void;
  trackClick: (data?: Record<string, any>) => void;
  identifyUser: (userId: string, traits?: Record<string, any>) => void;
  flushQueuedEvents: () => Promise<void>;
  destroySdk: () => void;
  trackAddToCart: (data: AddToCartData) => void;
  trackVariantSelect: (data: VariantSelectData) => void;
  trackImageZoom: (data: ImageZoomData) => void;
  captureProductSnapshot: (snapshot: ProductSnapshot) => void;
};

function throwIfNotBrowserEnvironment(): void {
  if (isBrowserEnvironment()) return;
  throw new Error('[Crow] SDK can only be initialized in browser environment');
}

function buildInternalConfig(userConfig: CrowConfig): InternalConfig {
  return {
    projectId: userConfig.projectId,
    apiEndpoint: NEXT_BASE_URL,
    capture: {
      ...DEFAULT_CAPTURE_CONFIG,
      ...userConfig.capture,
    },
    batching: DEFAULT_BATCHING_CONFIG,
    debug: userConfig.debug ?? false,
  };
}

function logDebugMessage(state: SdkState, message: string, data?: any): void {
  if (!state.config.debug) return;
  console.log(`[Crow] ${message}`, data || '');
}

function getCurrentScreenSize(): ScreenSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function buildSessionContext(): SessionContext {
  return {
    url: window.location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    screenSize: getCurrentScreenSize(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
  };
}

async function sendSessionStartRequest(state: SdkState): Promise<void> {
  const sessionContext = buildSessionContext();

  const response = await state.apiClient.startNewSession({
    projectId: state.config.projectId,
    sessionId: state.sessionId,
    user: state.user,
    context: sessionContext,
  });

  logDebugMessage(state, 'Session started', { response });
}

function calculateSessionDuration(state: SdkState): number {
  return Date.now() - state.sessionStartTime;
}

function buildInteractionDescription(
  eventType: EventType,
  data?: Record<string, any>
): string {
  switch (eventType) {
    case 'click':
      return `Clicked ${data?.descriptor || data?.elementPath || 'element'}`;
    case 'add_to_cart':
      return `Added to cart: ${data?.productId || 'product'}`;
    case 'variant_select':
      return `Selected variant: ${data?.variantName || data?.variantId || 'variant'}`;
    case 'image_zoom':
      return `Zoomed into product image`;
    case 'navigation':
      return `Navigated to ${data?.to || 'page'}`;
    default:
      return `${eventType} interaction`;
  }
}

function buildExitContext(
  state: SdkState,
  trigger: ExitTriggerType
): ExitContext {
  return {
    lastPageUrl: state.lastPageUrl,
    lastPageTitle: state.lastPageTitle,
    lastPageTimeSpentMs: Date.now() - state.lastPageEntryTime,
    exitTrigger: trigger,
    hadCartItems: state.hadCartItems,
    lastInteractions: state.recentInteractions.map((i) => ({
      type: i.type,
      timestamp: i.timestamp,
      description: i.description,
    })),
    totalSessionDurationMs: calculateSessionDuration(state),
  };
}

function updateExitTrackingState(
  state: SdkState,
  eventType: EventType,
  data?: Record<string, any>
): void {
  if (eventType === 'pageview' || eventType === 'navigation') {
    state.lastPageUrl = window.location.href;
    state.lastPageTitle = document.title;
    state.lastPageEntryTime = Date.now();
  }

  if (eventType === 'add_to_cart') {
    state.hadCartItems = true;
  }

  const trackableInteractions: EventType[] = [
    'click',
    'add_to_cart',
    'variant_select',
    'image_zoom',
    'navigation',
  ];

  if (trackableInteractions.includes(eventType)) {
    state.recentInteractions.push({
      type: eventType,
      timestamp: Date.now(),
      url: window.location.href,
      description: buildInteractionDescription(eventType, data),
    });

    if (state.recentInteractions.length > MAX_RECENT_INTERACTIONS) {
      state.recentInteractions = state.recentInteractions.slice(
        -MAX_RECENT_INTERACTIONS
      );
    }
  }
}

async function sendSessionEndRequest(
  state: SdkState,
  exitTrigger: ExitTriggerType = 'tab_close'
): Promise<void> {
  const sessionDuration = calculateSessionDuration(state);
  const exitContext = buildExitContext(state, exitTrigger);

  const response = await state.apiClient.endCurrentSession({
    projectId: state.config.projectId,
    sessionId: state.sessionId,
    duration: sessionDuration,
    pageViews: state.pageViewCount,
    interactions: state.interactionCount,
    exitContext,
  });

  logDebugMessage(state, 'Session ended', {
    response,
    duration: sessionDuration,
    exitTrigger,
  });
}

function buildBaseEvent(
  eventType: EventType,
  eventData?: Record<string, any>
): BaseEvent {
  return {
    type: eventType,
    timestamp: Date.now(),
    url: window.location.href,
    referrer: document.referrer,
    data: {
      ...eventData,
      pageTitle: document.title,
      scrollPosition: {
        x: window.scrollX,
        y: window.scrollY,
      },
      documentHeight: document.documentElement.scrollHeight,
    },
    userAgent: navigator.userAgent,
    screenSize: getCurrentScreenSize(),
  };
}

async function sendSingleEventToApi(
  state: SdkState,
  event: BaseEvent
): Promise<void> {
  const response = await state.apiClient.sendTrackingEvent({
    projectId: state.config.projectId,
    sessionId: state.sessionId,
    event,
    user: state.user,
  });

  logDebugMessage(state, 'Event sent', { event, response });
}

async function sendBatchedEventsToApi(
  state: SdkState,
  events: BaseEvent[]
): Promise<void> {
  if (events.length === 0) return;

  const response = await state.apiClient.sendBatchedEvents({
    projectId: state.config.projectId,
    sessionId: state.sessionId,
    events,
    user: state.user,
  });

  logDebugMessage(state, 'Batch sent', { eventCount: events.length, response });
}

function queueOrSendEventImmediately(state: SdkState, event: BaseEvent): void {
  if (state.config.batching.enabled && state.eventQueue) {
    state.eventQueue.addEventToQueue(event);
    logDebugMessage(state, 'Event queued', { event });
    return;
  }

  sendSingleEventToApi(state, event);
}

function incrementPageViewCounter(state: SdkState): void {
  state.pageViewCount++;
}

function incrementInteractionCounter(state: SdkState): void {
  state.interactionCount++;
}

function updateEventCounters(state: SdkState, eventType: EventType): void {
  if (eventType === 'pageview') {
    incrementPageViewCounter(state);
    return;
  }

  incrementInteractionCounter(state);
}

const ANALYTICS_ONLY_EVENTS: Set<EventType> = new Set([
  'click', 'rage_click', 'scroll', 'navigation',
]);

function trackEventAndExtendSession(
  state: SdkState,
  eventType: EventType,
  data?: Record<string, any>
): void {
  // Always update local state (counters, exit context) regardless of send gate
  updateEventCounters(state, eventType);
  updateExitTrackingState(state, eventType, data);
  extendCurrentSessionExpiry();

  // Skip sending to backend if gated
  if (ANALYTICS_ONLY_EVENTS.has(eventType) && !state.config.capture.sendAnalyticsEvents) {
    logDebugMessage(state, `Event "${eventType}" gated - not sent to backend`);
    return;
  }

  const event = buildBaseEvent(eventType, data);
  queueOrSendEventImmediately(state, event);
}

function registerCollectors(state: SdkState): void {
  const { capture } = state.config;

  // Always register ecommerce and context-snapshot (they're API-driven, not auto-capture)
  state.collectors.push(createEcommerceCollector());
  state.collectors.push(createContextSnapshotCollector());

  if (capture.errors) {
    state.collectors.push(createErrorCollector());
  }

  if (capture.navigation) {
    state.collectors.push(createNavigationCollector());
  }

  if (capture.engagement) {
    state.collectors.push(createEngagementCollector());
  }

  if (capture.interactions) {
    state.collectors.push(createInteractionCollector());
  }

  if (capture.performance) {
    state.collectors.push(createPerformanceCollector());
  }

  if (capture.replay) {
    state.collectors.push(createReplayCollector());
  }

  if (capture.autoContext) {
    state.collectors.push(createAutoContextCollector());
  }
}

function buildCollectorContext(state: SdkState): CollectorContext {
  return {
    trackEvent: (eventType: EventType, data?: Record<string, any>) =>
      trackEventAndExtendSession(state, eventType, data),
    config: state.config.capture,
    sessionId: state.sessionId,
    projectId: state.config.projectId,
    apiClient: state.apiClient,
    debug: (message: string, data?: any) => logDebugMessage(state, message, data),
  };
}

function initializeAllCollectors(state: SdkState): void {
  const context = buildCollectorContext(state);
  for (const collector of state.collectors) {
    try {
      collector.initialize(context);
      logDebugMessage(state, `Collector "${collector.name}" initialized`);
    } catch (error) {
      console.error(`[Crow] Failed to initialize collector "${collector.name}":`, error);
    }
  }
}

function destroyAllCollectors(state: SdkState): void {
  for (const collector of state.collectors) {
    try {
      collector.destroy();
    } catch (error) {
      console.error(`[Crow] Failed to destroy collector "${collector.name}":`, error);
    }
  }
  state.collectors = [];
}

function setupPageViewAutoCapture(state: SdkState): void {
  if (!state.config.capture.pageViews) return;
  trackEventAndExtendSession(state, 'pageview', { autoCapture: true });
}

function flushQueueIfExists(state: SdkState): void {
  if (!state.eventQueue) return;
  state.eventQueue.flushAllQueuedEvents();
}

function setupPageUnloadHandler(state: SdkState): void {
  window.addEventListener('beforeunload', () => {
    flushQueueIfExists(state);
    sendSessionEndRequest(state, 'tab_close');
  });
}

function createEventQueueIfBatchingEnabled(state: SdkState): void {
  if (!state.config.batching.enabled) return;

  state.eventQueue = createEventQueue(
    state.config.batching.maxBatchSize,
    state.config.batching.flushInterval,
    events => sendBatchedEventsToApi(state, events)
  );
}

async function initializeSdkInternal(state: SdkState): Promise<void> {
  if (state.isInitialized) {
    logDebugMessage(state, 'SDK already initialized');
    return;
  }

  await sendSessionStartRequest(state);
  createEventQueueIfBatchingEnabled(state);

  // Register and initialize collectors (handles clicks, errors, etc.)
  registerCollectors(state);
  initializeAllCollectors(state);

  // Auto-capture initial pageview
  setupPageViewAutoCapture(state);
  setupPageUnloadHandler(state);

  state.isInitialized = true;
  logDebugMessage(state, 'SDK initialization complete');
}

function updateUserIdentity(
  state: SdkState,
  userId: string,
  traits?: Record<string, any>
): void {
  state.user = {
    id: userId,
    anonymousId: state.anonymousId,
    traits,
  };

  logDebugMessage(state, 'User identified', { userId, traits });
}

async function flushAllQueuedEvents(state: SdkState): Promise<void> {
  if (!state.eventQueue) return;
  await state.eventQueue.flushAllQueuedEvents();
}

function destroyEventQueueIfExists(state: SdkState): void {
  if (!state.eventQueue) return;

  state.eventQueue.destroyQueue();
  state.eventQueue = null;
}

function destroySdkAndCleanup(state: SdkState): void {
  destroyAllCollectors(state);
  destroyEventQueueIfExists(state);
  sendSessionEndRequest(state, 'idle_timeout');
  state.isInitialized = false;
  logDebugMessage(state, 'SDK destroyed');
}

function makeGloballyAvailableForDebugging(sdkInstance: CrowSDK): void {
  if (typeof window === 'undefined') return;
  (window as any).crow = sdkInstance;
}

export function createCrowSDK(userConfig: CrowConfig): CrowSDK {
  throwIfNotBrowserEnvironment();

  const internalConfig = buildInternalConfig(userConfig);
  const apiClient = createApiClient(internalConfig.apiEndpoint);
  const sessionId = getOrCreateSessionId();
  const anonymousId = getOrCreateAnonymousId();

  const state: SdkState = {
    config: internalConfig,
    apiClient,
    sessionId,
    anonymousId,
    user: { anonymousId },
    eventQueue: null,
    sessionStartTime: Date.now(),
    pageViewCount: 0,
    interactionCount: 0,
    isInitialized: false,
    collectors: [],
    lastPageUrl: window.location.href,
    lastPageTitle: document.title,
    lastPageEntryTime: Date.now(),
    hadCartItems: false,
    recentInteractions: [],
  };

  logDebugMessage(state, 'SDK initialized', { config: internalConfig });

  const sdkInstance: CrowSDK = {
    initializeSdk: async () => initializeSdkInternal(state),
    trackEvent: (eventType, data) =>
      trackEventAndExtendSession(state, eventType, data),
    trackPageView: data => trackEventAndExtendSession(state, 'pageview', data),
    trackClick: data => trackEventAndExtendSession(state, 'click', data),
    identifyUser: (userId, traits) => updateUserIdentity(state, userId, traits),
    flushQueuedEvents: async () => flushAllQueuedEvents(state),
    destroySdk: () => destroySdkAndCleanup(state),
    trackAddToCart: data => ecommerceTrackAddToCart(data),
    trackVariantSelect: data => ecommerceTrackVariantSelect(data),
    trackImageZoom: data => ecommerceTrackImageZoom(data),
    captureProductSnapshot: snapshot => contextCaptureSnapshot(snapshot),
  };

  makeGloballyAvailableForDebugging(sdkInstance);

  return sdkInstance;
}
