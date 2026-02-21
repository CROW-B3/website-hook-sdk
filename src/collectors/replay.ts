import type { Collector, CollectorContext } from './types';

const FLUSH_INTERVAL_MS = 10_000;
const MAX_BUFFER_SIZE = 100;

export function createReplayCollector(): Collector {
  let ctx: CollectorContext | null = null;
  let stopRecording: (() => void) | null = null;
  let eventBuffer: any[] = [];
  let chunkIndex = 0;
  let flushTimer: number | null = null;
  let isFlushing = false;

  async function flushBuffer(): Promise<void> {
    if (!ctx || eventBuffer.length === 0 || isFlushing) return;

    isFlushing = true;
    const eventsToSend = [...eventBuffer];
    eventBuffer = [];
    const currentChunkIndex = chunkIndex;

    try {
      await ctx.apiClient.sendReplayBatch({
        projectId: ctx.projectId,
        sessionId: ctx.sessionId,
        chunkIndex: currentChunkIndex,
        events: eventsToSend,
        timestamp: Date.now(),
      });
      // Only increment on success to avoid gaps in chunk indexes
      chunkIndex++;
      ctx.debug('Replay chunk sent', { chunkIndex: currentChunkIndex, eventCount: eventsToSend.length });
    } catch (error) {
      // Re-queue events at front of buffer - chunkIndex stays the same so retry uses same index
      eventBuffer = [...eventsToSend, ...eventBuffer];
      console.error('[Crow] Failed to send replay chunk:', error);
    } finally {
      isFlushing = false;
    }
  }

  function startFlushTimer(): void {
    if (flushTimer !== null) return;

    flushTimer = window.setInterval(() => {
      flushBuffer();
    }, FLUSH_INTERVAL_MS);
  }

  function stopFlushTimer(): void {
    if (flushTimer !== null) {
      window.clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  return {
    name: 'replay',

    initialize(context: CollectorContext): void {
      ctx = context;
      eventBuffer = [];
      chunkIndex = 0;

      import('rrweb').then(({ record }) => {
        stopRecording = record({
          maskAllInputs: true,
          blockClass: 'crow-block',
          inlineImages: true,
          emit(event) {
            eventBuffer.push(event);

            if (eventBuffer.length >= MAX_BUFFER_SIZE) {
              flushBuffer();
            }
          },
        }) || null;

        startFlushTimer();
        ctx?.debug('Replay recording started');
      }).catch((error) => {
        console.error('[Crow] Failed to initialize rrweb:', error);
      });

      ctx.debug('Replay collector initialized');
    },

    destroy(): void {
      stopFlushTimer();

      if (stopRecording) {
        stopRecording();
        stopRecording = null;
      }

      flushBuffer();

      ctx = null;
    },
  };
}
