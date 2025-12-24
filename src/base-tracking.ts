import ky from 'ky';

/**
 * Base tracking utilities for common tracking functionality
 */
export namespace BaseTracking {
  /**
   * Base batch data that all tracking types should include
   */
  export interface BaseBatchData {
    sessionId: string;
    batchStartTime: number;
    batchEndTime: number;
    url: string;
    site?: string;
    hostname?: string;
    environment?: string;
  }

  /**
   * Configuration for batch logging
   */
  export interface LogConfig {
    prefix: string;
    logging: boolean;
  }

  /**
   * Log batch information with custom details
   */
  export function logBatchInfo<T extends BaseBatchData>(
    batch: T,
    config: LogConfig,
    customDetails?: Record<string, any>
  ): void {
    if (!config.logging) return;

    const duration = batch.batchEndTime - batch.batchStartTime;
    console.log(`${config.prefix} Batch ready - duration: ${duration}ms`, {
      sessionId: batch.sessionId,
      url: batch.url,
      site: batch.site,
      ...customDetails,
    });
  }

  /**
   * Log upload attempt for debugging
   */
  export function logUploadAttempt<T extends BaseBatchData>(
    batch: T,
    uploadUrl: string,
    config: LogConfig,
    customDetails?: Record<string, any>
  ): void {
    if (!config.logging) return;

    const duration = batch.batchEndTime - batch.batchStartTime;
    console.log(`${config.prefix} Uploading batch:`, {
      sessionId: batch.sessionId,
      uploadUrl,
      timeRange: `${batch.batchStartTime} - ${batch.batchEndTime}`,
      duration: `${duration}ms`,
      ...customDetails,
    });
  }

  /**
   * Upload batch to server (fire-and-forget) using JSON
   */
  export function uploadBatchJSON<T extends BaseBatchData>(
    batch: T,
    uploadUrl: string,
    config: LogConfig,
    customDetails?: Record<string, any>
  ): void {
    logUploadAttempt(batch, uploadUrl, config, customDetails);

    // Fire and forget - send data without waiting for response
    ky.post(uploadUrl, {
      json: batch,
    }).catch(error => {
      console.error(`${config.prefix} Upload error:`, error);
    });
  }

  /**
   * Upload data to server (fire-and-forget) using FormData
   */
  export function uploadFormData(
    formData: FormData,
    uploadUrl: string,
    config: LogConfig
  ): void {
    if (config.logging) {
      console.log(`${config.prefix} Uploading to:`, uploadUrl);
    }

    // Fire and forget - send data without waiting for response
    ky.post(uploadUrl, {
      body: formData,
    }).catch(error => {
      console.error(`${config.prefix} Upload error:`, error);
    });
  }

  /**
   * Generate a unique session ID
   */
  export function generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `session-${timestamp}-${random}`;
  }
}
