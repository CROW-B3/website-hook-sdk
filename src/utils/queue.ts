import type { BaseEvent } from '../types';

/**
 * Event queue for batching events before sending to the server
 */
export class EventQueue {
  private queue: BaseEvent[] = [];
  private readonly maxSize: number;
  private readonly flushInterval: number;
  private flushTimer: number | null = null;
  private readonly onFlush: (events: BaseEvent[]) => Promise<void>;

  constructor(
    maxSize: number,
    flushInterval: number,
    onFlush: (events: BaseEvent[]) => Promise<void>
  ) {
    this.maxSize = maxSize;
    this.flushInterval = flushInterval;
    this.onFlush = onFlush;
    this.startFlushTimer();
  }

  /**
   * Add an event to the queue
   */
  add(event: BaseEvent): void {
    this.queue.push(event);

    // Flush if queue is full
    if (this.queue.length >= this.maxSize) {
      this.flush();
    }
  }

  /**
   * Flush all events to the server
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const eventsToSend = [...this.queue];
    this.queue = [];

    try {
      await this.onFlush(eventsToSend);
    } catch (error) {
      console.error('[Crow] Error flushing events:', error);
      // Re-add events to queue on failure
      this.queue = [...eventsToSend, ...this.queue];
    }
  }

  /**
   * Start the automatic flush timer
   */
  private startFlushTimer(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop the flush timer
   */
  destroy(): void {
    if (this.flushTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining events
    this.flush();
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }
}
