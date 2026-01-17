import type { BaseEvent } from '../types';

export type EventQueue = {
  addEventToQueue: (event: BaseEvent) => void;
  flushAllQueuedEvents: () => Promise<void>;
  destroyQueue: () => void;
  getCurrentQueueSize: () => number;
};

type EventQueueState = {
  queuedEvents: BaseEvent[];
  flushTimerId: number | null;
};

function isWindowDefined(): boolean {
  return typeof window !== 'undefined';
}

async function sendEventsAndHandleFailure(
  eventsToSend: BaseEvent[],
  state: EventQueueState,
  onFlushCallback: (events: BaseEvent[]) => Promise<void>
): Promise<void> {
  try {
    await onFlushCallback(eventsToSend);
  } catch (error) {
    console.error('[Crow] Error flushing events:', error);
    state.queuedEvents = [...eventsToSend, ...state.queuedEvents];
    throw error;
  }
}

async function flushEventsFromQueue(
  state: EventQueueState,
  onFlushCallback: (events: BaseEvent[]) => Promise<void>
): Promise<void> {
  if (state.queuedEvents.length === 0) return;

  const eventsToSend = [...state.queuedEvents];
  state.queuedEvents = [];

  await sendEventsAndHandleFailure(eventsToSend, state, onFlushCallback);
}

function startAutomaticFlushTimer(
  flushIntervalMs: number,
  state: EventQueueState,
  onFlushCallback: (events: BaseEvent[]) => Promise<void>
): void {
  if (!isWindowDefined()) return;

  state.flushTimerId = window.setInterval(() => {
    flushEventsFromQueue(state, onFlushCallback);
  }, flushIntervalMs);
}

function stopFlushTimerIfExists(state: EventQueueState): void {
  if (!state.flushTimerId) return;
  if (!isWindowDefined()) return;

  window.clearInterval(state.flushTimerId);
  state.flushTimerId = null;
}

export function createEventQueue(
  maxBatchSize: number,
  flushIntervalMs: number,
  onFlushCallback: (events: BaseEvent[]) => Promise<void>
): EventQueue {
  const state: EventQueueState = {
    queuedEvents: [],
    flushTimerId: null,
  };

  startAutomaticFlushTimer(flushIntervalMs, state, onFlushCallback);

  return {
    addEventToQueue: (event: BaseEvent) => {
      state.queuedEvents.push(event);

      if (state.queuedEvents.length >= maxBatchSize) {
        flushEventsFromQueue(state, onFlushCallback);
      }
    },

    flushAllQueuedEvents: async () => {
      await flushEventsFromQueue(state, onFlushCallback);
    },

    destroyQueue: () => {
      stopFlushTimerIfExists(state);
      flushEventsFromQueue(state, onFlushCallback);
    },

    getCurrentQueueSize: () => state.queuedEvents.length,
  };
}
