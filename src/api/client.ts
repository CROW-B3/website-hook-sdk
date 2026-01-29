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

const TEN_SECONDS_TIMEOUT_MS = 10000;
const RETRYABLE_HTTP_STATUS_CODES = [408, 413, 429, 500, 502, 503, 504];
const MAX_RETRY_ATTEMPTS = 3;

export type ApiClient = {
  sendTrackingEvent: (data: TrackRequest) => Promise<ApiResponse>;
  sendBatchedEvents: (data: BatchRequest) => Promise<BatchResponse>;
  startNewSession: (data: SessionStartRequest) => Promise<SessionResponse>;
  endCurrentSession: (data: SessionEndRequest) => Promise<ApiResponse>;
};

function createHttpClient(baseUrl: string) {
  return ky.create({
    prefixUrl: baseUrl,
    timeout: TEN_SECONDS_TIMEOUT_MS,
    retry: {
      limit: MAX_RETRY_ATTEMPTS,
      methods: ['post'],
      statusCodes: RETRYABLE_HTTP_STATUS_CODES,
    },
  });
}

async function sendTrackRequest(
  httpClient: ReturnType<typeof ky.create>,
  trackData: TrackRequest
): Promise<ApiResponse> {
  try {
    return await httpClient
      .post('track', { json: trackData })
      .json<ApiResponse>();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send tracking event: ${errorMessage}`);
  }
}

async function sendBatchRequest(
  httpClient: ReturnType<typeof ky.create>,
  batchData: BatchRequest
): Promise<BatchResponse> {
  try {
    return await httpClient
      .post('batch', { json: batchData })
      .json<BatchResponse>();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send batched events: ${errorMessage}`);
  }
}

async function sendSessionStartRequest(
  httpClient: ReturnType<typeof ky.create>,
  sessionData: SessionStartRequest
): Promise<SessionResponse> {
  try {
    return await httpClient
      .post('session/start', { json: sessionData })
      .json<SessionResponse>();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to start session: ${errorMessage}`);
  }
}

async function sendSessionEndRequest(
  httpClient: ReturnType<typeof ky.create>,
  sessionEndData: SessionEndRequest
): Promise<ApiResponse> {
  try {
    return await httpClient
      .post('session/end', { json: sessionEndData })
      .json<ApiResponse>();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to end session: ${errorMessage}`);
  }
}

export function createApiClient(baseUrl: string): ApiClient {
  const httpClient = createHttpClient(baseUrl);

  return {
    sendTrackingEvent: async (data: TrackRequest) =>
      sendTrackRequest(httpClient, data),
    sendBatchedEvents: async (data: BatchRequest) =>
      sendBatchRequest(httpClient, data),
    startNewSession: async (data: SessionStartRequest) =>
      sendSessionStartRequest(httpClient, data),
    endCurrentSession: async (data: SessionEndRequest) =>
      sendSessionEndRequest(httpClient, data),
  };
}
