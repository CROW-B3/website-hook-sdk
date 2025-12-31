import ky from 'ky';
import type {
  ApiResponse,
  BatchRequest,
  BatchResponse,
  SessionEndRequest,
  SessionResponse,
  SessionStartRequest,
  TrackRequest,
} from '../types';

/**
 * API Client for communicating with the web-ingest-worker
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly client: typeof ky;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.client = ky.create({
      prefixUrl: baseUrl,
      timeout: 10000, // 10 seconds
      retry: {
        limit: 3,
        methods: ['post'],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
      },
    });
  }

  /**
   * Send a single event
   */
  async track(data: TrackRequest): Promise<ApiResponse> {
    try {
      const response = await this.client
        .post('track', {
          json: data,
        })
        .json<ApiResponse>();
      return response;
    } catch (error) {
      console.error('[Crow] Track error:', error);
      return { success: false, errors: [(error as Error).message] };
    }
  }

  /**
   * Send batched events
   */
  async batch(data: BatchRequest): Promise<BatchResponse> {
    try {
      const response = await this.client
        .post('batch', {
          json: data,
        })
        .json<BatchResponse>();
      return response;
    } catch (error) {
      console.error('[Crow] Batch error:', error);
      return { success: false, processed: 0, failed: data.events.length };
    }
  }

  /**
   * Start a new session
   */
  async sessionStart(data: SessionStartRequest): Promise<SessionResponse> {
    try {
      const response = await this.client
        .post('session/start', {
          json: data,
        })
        .json<SessionResponse>();
      return response;
    } catch (error) {
      console.error('[Crow] Session start error:', error);
      return { success: false };
    }
  }

  /**
   * End a session
   */
  async sessionEnd(data: SessionEndRequest): Promise<ApiResponse> {
    try {
      const response = await this.client
        .post('session/end', {
          json: data,
        })
        .json<ApiResponse>();
      return response;
    } catch (error) {
      console.error('[Crow] Session end error:', error);
      return { success: false, errors: [(error as Error).message] };
    }
  }
}
