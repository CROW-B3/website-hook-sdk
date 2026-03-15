import type { BaseEvent } from '../types';

type EventCallback = (event: BaseEvent) => void;

let originalFetch: typeof fetch | null = null;
let originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
let originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function captureOriginals(): void {
  if (!isBrowser()) return;
  if (originalFetch === null) {
    originalFetch = window.fetch.bind(window);
  }
  if (originalXHROpen === null) {
    originalXHROpen = XMLHttpRequest.prototype.open;
  }
  if (originalXHRSend === null) {
    originalXHRSend = XMLHttpRequest.prototype.send;
  }
}

function createNetworkRequestEvent(
  method: string,
  url: string,
  status: number,
  duration: number
): BaseEvent {
  return {
    type: 'network_request',
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      method,
      requestUrl: url,
      status,
      duration,
    },
  };
}

function setupFetchInterception(onEvent: EventCallback): () => void {
  if (!isBrowser() || !originalFetch) {
    return () => {};
  }

  const savedOriginalFetch = originalFetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const startTime = Date.now();
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = init?.method || 'GET';

    try {
      const response = await savedOriginalFetch(input, init);
      const duration = Date.now() - startTime;

      const event = createNetworkRequestEvent(
        method,
        url,
        response.status,
        duration
      );
      onEvent(event);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      const event = createNetworkRequestEvent(method, url, 0, duration);
      onEvent(event);
      throw error;
    }
  };

  return () => {
    window.fetch = savedOriginalFetch;
  };
}

function setupXHRInterception(onEvent: EventCallback): () => void {
  if (!isBrowser() || !originalXHROpen || !originalXHRSend) {
    return () => {};
  }

  const savedOriginalXHROpen = originalXHROpen;
  const savedOriginalXHRSend = originalXHRSend;

  const requests = new WeakMap<
    XMLHttpRequest,
    { method: string; url: string; startTime: number }
  >();

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    requests.set(this, {
      method,
      url: url.toString(),
      startTime: Date.now(),
    });
    return savedOriginalXHROpen.call(
      this,
      method,
      url,
      async ?? true,
      username,
      password
    );
  };

  XMLHttpRequest.prototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const requestData = requests.get(this);

    if (requestData) {
      this.addEventListener('loadend', () => {
        const duration = Date.now() - requestData.startTime;
        const event = createNetworkRequestEvent(
          requestData.method,
          requestData.url,
          this.status,
          duration
        );
        onEvent(event);
      });
    }

    return savedOriginalXHRSend.call(this, body);
  };

  return () => {
    XMLHttpRequest.prototype.open = savedOriginalXHROpen;
    XMLHttpRequest.prototype.send = savedOriginalXHRSend;
  };
}

export function setupNetworkMonitoring(onEvent: EventCallback): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  captureOriginals();

  const cleanupFunctions: Array<() => void> = [
    setupFetchInterception(onEvent),
    setupXHRInterception(onEvent),
  ];

  return () => {
    for (const cleanup of cleanupFunctions) {
      cleanup();
    }
  };
}
