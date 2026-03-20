import type { BaseEvent } from '../types';

type AdvancedEventsConfig = {
  enableClipboard: boolean;
  enableVisibility: boolean;
  enableMedia: boolean;
};

type EventCallback = (event: BaseEvent) => void;

function createClipboardEvent(type: 'copy' | 'paste'): BaseEvent {
  const eventType = type === 'copy' ? 'clipboard_copy' : 'clipboard_paste';
  return {
    type: eventType,
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      action: type,
    },
  } as BaseEvent;
}

function createVisibilityChangeEvent(): BaseEvent {
  return {
    type: 'visibility_change',
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      hidden: document.hidden,
      visibilityState: document.visibilityState,
    },
  } as BaseEvent;
}

function createMediaEvent(
  type: 'play' | 'pause',
  element: HTMLMediaElement
): BaseEvent {
  const eventType = type === 'play' ? 'media_play' : 'media_pause';
  return {
    type: eventType,
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      action: type,
      mediaType: element.tagName.toLowerCase(),
      currentTime: element.currentTime,
      duration: element.duration,
      src: element.currentSrc?.substring(0, 200),
    },
  } as BaseEvent;
}

function createDownloadEvent(url: string): BaseEvent {
  return {
    type: 'download',
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      downloadUrl: url,
      fileName: url.split('/').pop(),
    },
  } as BaseEvent;
}

function setupClipboardTracking(onEvent: EventCallback): () => void {
  const copyHandler = () => {
    const event = createClipboardEvent('copy');
    onEvent(event);
  };

  const pasteHandler = () => {
    const event = createClipboardEvent('paste');
    onEvent(event);
  };

  document.addEventListener('copy', copyHandler);
  document.addEventListener('paste', pasteHandler);

  return () => {
    document.removeEventListener('copy', copyHandler);
    document.removeEventListener('paste', pasteHandler);
  };
}

function setupVisibilityTracking(onEvent: EventCallback): () => void {
  const handler = () => {
    const event = createVisibilityChangeEvent();
    onEvent(event);
  };

  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

function setupMediaTracking(onEvent: EventCallback): () => void {
  const playHandler = (event: Event) => {
    if (event.target instanceof HTMLMediaElement) {
      const mediaEvent = createMediaEvent('play', event.target);
      onEvent(mediaEvent);
    }
  };

  const pauseHandler = (event: Event) => {
    if (event.target instanceof HTMLMediaElement) {
      const mediaEvent = createMediaEvent('pause', event.target);
      onEvent(mediaEvent);
    }
  };

  document.addEventListener('play', playHandler, true);
  document.addEventListener('pause', pauseHandler, true);

  return () => {
    document.removeEventListener('play', playHandler, true);
    document.removeEventListener('pause', pauseHandler, true);
  };
}

function setupDownloadTracking(onEvent: EventCallback): () => void {
  const clickHandler = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');

    if (!anchor) return;

    const href = anchor.getAttribute('href');
    const download = anchor.getAttribute('download');

    if (download !== null && href) {
      const downloadEvent = createDownloadEvent(href);
      onEvent(downloadEvent);
    }
  };

  document.addEventListener('click', clickHandler);
  return () => document.removeEventListener('click', clickHandler);
}

export function setupAdvancedEventsTracking(
  config: AdvancedEventsConfig,
  onEvent: EventCallback
): () => void {
  const cleanupFunctions: Array<() => void> = [];

  if (config.enableClipboard) {
    cleanupFunctions.push(setupClipboardTracking(onEvent));
  }

  if (config.enableVisibility) {
    cleanupFunctions.push(setupVisibilityTracking(onEvent));
  }

  if (config.enableMedia) {
    cleanupFunctions.push(setupMediaTracking(onEvent));
  }

  cleanupFunctions.push(setupDownloadTracking(onEvent));

  return () => {
    for (const cleanup of cleanupFunctions) {
      cleanup();
    }
  };
}
