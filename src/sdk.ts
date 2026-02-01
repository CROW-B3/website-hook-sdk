import type { BaseEvent, CrowConfig, EventType, ScreenSize } from './types';
import type { ApiClient } from './api/client';
import type { EventQueue } from './utils/queue';
import type { SessionData } from './utils/id';
import { createApiClient } from './api/client';
import { getOrCreateSessionId } from './utils/id';
import { createEventQueue } from './utils/queue';
import { isBrowserEnvironment } from './utils/environment';
import { NEXT_BASE_URL } from './constants';

const DEFAULT_CAPTURE_CONFIG = {
  pageViews: true,
  clicks: true,
  errors: true,
} as const;

const DEFAULT_BATCHING_CONFIG = {
  enabled: true,
  maxBatchSize: 10,
  flushInterval: 5000,
} as const;

type InternalConfig = {
  apiEndpoint: string;
  capture: {
    pageViews: boolean;
    clicks: boolean;
    errors: boolean;
  };
  batching: {
    enabled: boolean;
    maxBatchSize: number;
    flushInterval: number;
  };
  debug: boolean;
};

type SdkState = {
  config: InternalConfig;
  apiClient: ApiClient;
  sessionData: SessionData;
  apiKey: string;
  eventQueue: EventQueue | null;
  isInitialized: boolean;
};

export type CrowSDK = {
  initializeSdk: () => Promise<void>;
  trackEvent: (eventType: EventType, data?: Record<string, any>) => void;
  trackPageView: (data?: Record<string, any>) => void;
  trackClick: (data?: Record<string, any>) => void;
  flushQueuedEvents: () => Promise<void>;
  destroySdk: () => void;
};

function throwIfNotBrowserEnvironment(): void {
  if (isBrowserEnvironment()) return;
  throw new Error('[Crow] SDK can only be initialized in browser environment');
}

function buildInternalConfig(userConfig: CrowConfig): InternalConfig {
  return {
    apiEndpoint: NEXT_BASE_URL,
    capture: DEFAULT_CAPTURE_CONFIG,
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

function buildBaseEvent(
  eventType: EventType,
  eventData?: Record<string, any>
): BaseEvent {
  return {
    type: eventType,
    timestamp: Date.now(),
    url: window.location.href,
    referrer: document.referrer,
    data: eventData,
    userAgent: navigator.userAgent,
    screenSize: getCurrentScreenSize(),
  };
}

async function sendSingleEventToApi(
  state: SdkState,
  event: BaseEvent
): Promise<void> {
  const response = await state.apiClient.sendTrackingEvent({
    sessionId: state.sessionData.sessionId,
    event,
    apiKey: state.apiKey,
  });

  logDebugMessage(state, 'Event sent', { event, response });
}

async function sendBatchedEventsToApi(
  state: SdkState,
  events: BaseEvent[]
): Promise<void> {
  if (events.length === 0) return;

  const response = await state.apiClient.sendBatchedEvents({
    sessionId: state.sessionData.sessionId,
    events,
    apiKey: state.apiKey,
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

function trackEvent(
  state: SdkState,
  eventType: EventType,
  data?: Record<string, any>
): void {
  const event = buildBaseEvent(eventType, data);
  queueOrSendEventImmediately(state, event);
}

function extractClickDataFromEvent(
  clickEvent: MouseEvent
): Record<string, any> {
  const targetElement = clickEvent.target as HTMLElement;
  return {
    tagName: targetElement.tagName,
    id: targetElement.id || undefined,
    className: targetElement.className || undefined,
    text: targetElement.textContent?.substring(0, 100),
    autoCapture: true,
  };
}

function setupClickAutoCapture(state: SdkState): void {
  if (!state.config.capture.clicks) return;

  document.addEventListener('click', clickEvent => {
    const clickData = extractClickDataFromEvent(clickEvent);
    trackEvent(state, 'click', clickData);
  });
}

function extractErrorDataFromEvent(
  errorEvent: ErrorEvent
): Record<string, any> {
  return {
    message: errorEvent.message,
    filename: errorEvent.filename,
    lineno: errorEvent.lineno,
    colno: errorEvent.colno,
    autoCapture: true,
  };
}

function setupErrorAutoCapture(state: SdkState): void {
  if (!state.config.capture.errors) return;

  window.addEventListener('error', errorEvent => {
    const errorData = extractErrorDataFromEvent(errorEvent);
    trackEvent(state, 'error', errorData);
  });
}

function setupPageViewAutoCapture(state: SdkState): void {
  if (!state.config.capture.pageViews) return;
  trackEvent(state, 'pageview', { autoCapture: true });
}

function setupAllAutoCapture(state: SdkState): void {
  setupPageViewAutoCapture(state);
  setupClickAutoCapture(state);
  setupErrorAutoCapture(state);
}

function flushQueueIfExists(state: SdkState): void {
  if (!state.eventQueue) return;
  state.eventQueue.flushAllQueuedEvents();
}

function setupPageUnloadHandler(state: SdkState): void {
  window.addEventListener('beforeunload', () => {
    flushQueueIfExists(state);
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

  createEventQueueIfBatchingEnabled(state);
  setupAllAutoCapture(state);
  setupPageUnloadHandler(state);

  state.isInitialized = true;
  logDebugMessage(state, 'SDK initialization complete');
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
  destroyEventQueueIfExists(state);
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
  const sessionData = getOrCreateSessionId();

  const state: SdkState = {
    config: internalConfig,
    apiClient,
    sessionData,
    apiKey: userConfig.apiKey,
    eventQueue: null,
    isInitialized: false,
  };

  logDebugMessage(state, 'SDK initialized', {
    config: internalConfig,
    sessionData,
  });

  const sdkInstance: CrowSDK = {
    initializeSdk: async () => initializeSdkInternal(state),
    trackEvent: (eventType, data) => trackEvent(state, eventType, data),
    trackPageView: data => trackEvent(state, 'pageview', data),
    trackClick: data => trackEvent(state, 'click', data),
    flushQueuedEvents: async () => flushAllQueuedEvents(state),
    destroySdk: () => destroySdkAndCleanup(state),
  };

  makeGloballyAvailableForDebugging(sdkInstance);

  return sdkInstance;
}
