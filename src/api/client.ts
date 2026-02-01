import ky from 'ky';
import type {
  ApiResponse,
  BatchRequest,
  BatchResponse,
  TrackRequest,
} from '../types';

const TEN_SECONDS_TIMEOUT_MS = 10000;
const RETRYABLE_HTTP_STATUS_CODES = [408, 413, 429, 500, 502, 503, 504];
const MAX_RETRY_ATTEMPTS = 3;

export type ApiClient = {
  sendTrackingEvent: (data: TrackRequest) => Promise<ApiResponse>;
  sendBatchedEvents: (data: BatchRequest) => Promise<BatchResponse>;
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
      .post('track', {
        json: trackData,
        headers: {
          Authorization: `Bearer ${trackData.apiKey}`,
        },
      })
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
      .post('batch', {
        json: batchData,
        headers: {
          Authorization: `Bearer ${batchData.apiKey}`,
        },
      })
      .json<BatchResponse>();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send batched events: ${errorMessage}`);
  }
}

export function createApiClient(baseUrl: string): ApiClient {
  const httpClient = createHttpClient(baseUrl);

  return {
    sendTrackingEvent: async (data: TrackRequest) =>
      sendTrackRequest(httpClient, data),
    sendBatchedEvents: async (data: BatchRequest) =>
      sendBatchRequest(httpClient, data),
  };
}
