import type { BaseEvent } from '../types';

type EventCallback = (event: BaseEvent) => void;

type RRwebConfig = {
  sampleRate?: number;
  maskAllInputs?: boolean;
  maskTextSelector?: string;
  blockSelector?: string;
};

export function setupRRwebRecording(
  config: RRwebConfig,
  onEvent: EventCallback
): () => void {
  let stopRecording: (() => void) | null = null;

  const initializeRecording = async () => {
    try {
      const rrweb = await import('rrweb');

      const result = rrweb.record({
        emit(event: any) {
          const isFullSnapshot = event.type === 2;
          const eventType = isFullSnapshot
            ? 'rrweb_snapshot'
            : 'rrweb_incremental';
          const baseEvent: BaseEvent = {
            type: eventType,
            timestamp: event.timestamp || Date.now(),
            url: window.location.href,
            data: {
              rrwebEvent: event,
              compressed: false,
            },
          } as BaseEvent;
          onEvent(baseEvent);
        },
        sampling: {
          input: 'last' as const,
        },
        maskAllInputs: config.maskAllInputs ?? true,
        maskTextSelector: config.maskTextSelector || '.rr-mask',
        blockSelector: config.blockSelector || '.rr-block',
        ignoreSelector: '.rr-ignore',
        checkoutEveryNms: 15 * 60 * 1000,
      });

      if (result) {
        stopRecording = result;
      }
    } catch (error) {
      console.error('[Crow] Failed to initialize rrweb recording:', error);
    }
  };

  initializeRecording();

  return () => {
    if (stopRecording) {
      stopRecording();
    }
  };
}
