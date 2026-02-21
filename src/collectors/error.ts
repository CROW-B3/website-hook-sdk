import type { Collector, CollectorContext } from './types';

export function createErrorCollector(): Collector {
  let ctx: CollectorContext | null = null;
  let errorHandler: ((event: ErrorEvent) => void) | null = null;
  let rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

  function handleError(event: ErrorEvent): void {
    if (!ctx) return;

    ctx.trackEvent('error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack || undefined,
      type: 'uncaught_error',
      autoCapture: true,
    });

    ctx.debug('Error captured', { message: event.message });
  }

  function handleUnhandledRejection(event: PromiseRejectionEvent): void {
    if (!ctx) return;

    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;

    ctx.trackEvent('error', {
      message,
      stack,
      type: 'unhandled_rejection',
      autoCapture: true,
    });

    ctx.debug('Unhandled rejection captured', { message });
  }

  return {
    name: 'error',

    initialize(context: CollectorContext): void {
      ctx = context;

      errorHandler = handleError;
      rejectionHandler = handleUnhandledRejection;

      window.addEventListener('error', errorHandler);
      window.addEventListener('unhandledrejection', rejectionHandler);

      ctx.debug('Error collector initialized');
    },

    destroy(): void {
      if (errorHandler) window.removeEventListener('error', errorHandler);
      if (rejectionHandler) window.removeEventListener('unhandledrejection', rejectionHandler);
      ctx = null;
    },
  };
}
