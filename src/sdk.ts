import type {
  BaseEvent,
  CrowConfig,
  EventType,
  ScreenSize,
  SessionContext,
  User,
} from './types';
import { ApiClient } from './api/client';
import { extendSession, getAnonymousId, getSessionId } from './utils/id';
import { EventQueue } from './utils/queue';
import { isBrowserEnvironment } from './utils/environment';

/**
 * Main Crow SDK class
 */
export class CrowSDK {
  private config: Required<CrowConfig>;
  private apiClient: ApiClient;
  private sessionId: string;
  private anonymousId: string;
  private user: User | null = null;
  private eventQueue: EventQueue | null = null;
  private sessionStartTime: number;
  private pageViewCount = 0;
  private interactionCount = 0;
  private isInitialized = false;

  constructor(config: CrowConfig) {
    // Validate browser environment
    if (!isBrowserEnvironment()) {
      throw new Error(
        '[Crow] SDK can only be initialized in browser environment'
      );
    }

    // Set default configuration
    this.config = {
      projectId: config.projectId,
      apiEndpoint:
        config.apiEndpoint ||
        'https://crow-web-ingest-worker-dev.bitbybit-b3.workers.dev',
      capture: {
        pageViews: config.capture?.pageViews ?? true,
        clicks: config.capture?.clicks ?? true,
        forms: config.capture?.forms ?? false,
        errors: config.capture?.errors ?? true,
        performance: config.capture?.performance ?? false,
      },
      batching: {
        enabled: config.batching?.enabled ?? true,
        maxBatchSize: config.batching?.maxBatchSize ?? 10,
        flushInterval: config.batching?.flushInterval ?? 5000,
      },
      privacy: {
        maskPasswords: config.privacy?.maskPasswords ?? true,
        maskCreditCards: config.privacy?.maskCreditCards ?? true,
        respectDoNotTrack: config.privacy?.respectDoNotTrack ?? true,
      },
      debug: config.debug ?? false,
    };

    // Initialize API client
    this.apiClient = new ApiClient(this.config.apiEndpoint);

    // Initialize session and user IDs
    this.sessionId = getSessionId();
    this.anonymousId = getAnonymousId();
    this.sessionStartTime = Date.now();

    // Initialize user
    this.user = {
      anonymousId: this.anonymousId,
    };

    this.log('SDK initialized', { config: this.config });
  }

  /**
   * Initialize the SDK and start tracking
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      this.log('SDK already initialized');
      return;
    }

    // Start session
    await this.startSession();

    // Initialize event queue if batching is enabled
    if (this.config.batching.enabled) {
      this.eventQueue = new EventQueue(
        this.config.batching.maxBatchSize!,
        this.config.batching.flushInterval!,
        events => this.sendBatch(events)
      );
    }

    // Set up auto-capture
    this.setupAutoCapture();

    // Set up page unload handler
    this.setupPageUnloadHandler();

    this.isInitialized = true;
    this.log('SDK initialization complete');
  }

  /**
   * Start a new session
   */
  private async startSession(): Promise<void> {
    const context: SessionContext = {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenSize: this.getScreenSize(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
    };

    const response = await this.apiClient.sessionStart({
      projectId: this.config.projectId,
      sessionId: this.sessionId,
      user: this.user!,
      context,
    });

    this.log('Session started', { response });
  }

  /**
   * End the current session
   */
  private async endSession(): Promise<void> {
    const duration = Date.now() - this.sessionStartTime;

    const response = await this.apiClient.sessionEnd({
      projectId: this.config.projectId,
      sessionId: this.sessionId,
      duration,
      pageViews: this.pageViewCount,
      interactions: this.interactionCount,
    });

    this.log('Session ended', {
      response,
      duration,
      pageViews: this.pageViewCount,
      interactions: this.interactionCount,
    });
  }

  /**
   * Track a custom event
   */
  track(eventType: EventType, data?: Record<string, any>): void {
    const event: BaseEvent = {
      type: eventType,
      timestamp: Date.now(),
      url: window.location.href,
      referrer: document.referrer,
      data,
      userAgent: navigator.userAgent,
      screenSize: this.getScreenSize(),
    };

    this.queueOrSendEvent(event);

    // Update counters
    if (eventType === 'pageview') {
      this.pageViewCount++;
    } else {
      this.interactionCount++;
    }

    extendSession();
  }

  /**
   * Track a page view
   */
  pageView(data?: Record<string, any>): void {
    this.track('pageview', data);
  }

  /**
   * Track a click event
   */
  click(data?: Record<string, any>): void {
    this.track('click', data);
  }

  /**
   * Identify a user
   */
  identify(userId: string, traits?: Record<string, any>): void {
    this.user = {
      id: userId,
      anonymousId: this.anonymousId,
      traits,
    };

    this.log('User identified', { userId, traits });
  }

  /**
   * Queue or send an event based on batching configuration
   */
  private queueOrSendEvent(event: BaseEvent): void {
    if (this.config.batching.enabled && this.eventQueue) {
      this.eventQueue.add(event);
      this.log('Event queued', { event });
    } else {
      this.sendSingleEvent(event);
    }
  }

  /**
   * Send a single event immediately
   */
  private async sendSingleEvent(event: BaseEvent): Promise<void> {
    const response = await this.apiClient.track({
      projectId: this.config.projectId,
      sessionId: this.sessionId,
      event,
      user: this.user!,
    });

    this.log('Event sent', { event, response });
  }

  /**
   * Send batched events
   */
  private async sendBatch(events: BaseEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const response = await this.apiClient.batch({
      projectId: this.config.projectId,
      sessionId: this.sessionId,
      events,
      user: this.user!,
    });

    this.log('Batch sent', { eventCount: events.length, response });
  }

  /**
   * Set up auto-capture for page views and clicks
   */
  private setupAutoCapture(): void {
    // Auto-capture page views
    if (this.config.capture.pageViews) {
      this.pageView({ autoCapture: true });
    }

    // Auto-capture clicks
    if (this.config.capture.clicks) {
      document.addEventListener('click', event => {
        const target = event.target as HTMLElement;
        const data = {
          tagName: target.tagName,
          id: target.id || undefined,
          className: target.className || undefined,
          text: target.textContent?.substring(0, 100),
          autoCapture: true,
        };
        this.click(data);
      });
    }

    // Auto-capture errors
    if (this.config.capture.errors) {
      window.addEventListener('error', event => {
        this.track('error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          autoCapture: true,
        });
      });
    }
  }

  /**
   * Set up handler for page unload (send remaining events and end session)
   */
  private setupPageUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      // Flush any remaining events
      if (this.eventQueue) {
        this.eventQueue.flush();
      }

      // End session
      this.endSession();
    });
  }

  /**
   * Get screen size
   */
  private getScreenSize(): ScreenSize {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  /**
   * Log debug messages
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[Crow] ${message}`, data || '');
    }
  }

  /**
   * Manually flush all queued events
   */
  async flush(): Promise<void> {
    if (this.eventQueue) {
      await this.eventQueue.flush();
    }
  }

  /**
   * Destroy the SDK instance
   */
  destroy(): void {
    if (this.eventQueue) {
      this.eventQueue.destroy();
      this.eventQueue = null;
    }

    this.endSession();
    this.isInitialized = false;
    this.log('SDK destroyed');
  }
}
