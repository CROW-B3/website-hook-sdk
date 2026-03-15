import type { BaseEvent } from '../types';

type EventCallback = (event: BaseEvent) => void;

function getFormElementData(element: HTMLElement): Record<string, any> {
  const formElement =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
      ? element
      : null;

  if (!formElement) {
    return {
      tagName: element.tagName,
      id: element.id || undefined,
      className: element.className || undefined,
    };
  }

  return {
    tagName: formElement.tagName,
    id: formElement.id || undefined,
    name: formElement.name || undefined,
    type:
      formElement instanceof HTMLInputElement ? formElement.type : undefined,
    className: formElement.className || undefined,
  };
}

function createFormFocusEvent(element: HTMLElement): BaseEvent {
  return {
    type: 'form_focus',
    timestamp: Date.now(),
    url: window.location.href,
    data: getFormElementData(element),
  };
}

function createFormBlurEvent(element: HTMLElement): BaseEvent {
  return {
    type: 'form_blur',
    timestamp: Date.now(),
    url: window.location.href,
    data: getFormElementData(element),
  };
}

function createFormInputEvent(element: HTMLElement): BaseEvent {
  const formElement =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
      ? element
      : null;

  return {
    type: 'form_input',
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      ...getFormElementData(element),
      valueLength: formElement?.value.length || 0,
    },
  };
}

function createFormValidationEvent(
  element: HTMLElement,
  isValid: boolean
): BaseEvent {
  const formElement =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
      ? element
      : null;

  return {
    type: 'form_validation',
    timestamp: Date.now(),
    url: window.location.href,
    data: {
      ...getFormElementData(element),
      valid: isValid,
      validationMessage: formElement?.validationMessage || undefined,
    },
  };
}

function isFormElement(element: EventTarget | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;

  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

function setupFormFocusTracking(onEvent: EventCallback): () => void {
  const handler = (event: FocusEvent) => {
    if (!isFormElement(event.target)) return;
    const formEvent = createFormFocusEvent(event.target);
    onEvent(formEvent);
  };

  document.addEventListener('focusin', handler, true);
  return () => document.removeEventListener('focusin', handler, true);
}

function setupFormBlurTracking(onEvent: EventCallback): () => void {
  const handler = (event: FocusEvent) => {
    if (!isFormElement(event.target)) return;
    const formEvent = createFormBlurEvent(event.target);
    onEvent(formEvent);
  };

  document.addEventListener('focusout', handler, true);
  return () => document.removeEventListener('focusout', handler, true);
}

function setupFormInputTracking(onEvent: EventCallback): () => void {
  const handler = (event: Event) => {
    if (!isFormElement(event.target)) return;
    const formEvent = createFormInputEvent(event.target);
    onEvent(formEvent);
  };

  document.addEventListener('input', handler, true);
  return () => document.removeEventListener('input', handler, true);
}

function setupFormValidationTracking(onEvent: EventCallback): () => void {
  const handler = (event: Event) => {
    if (!isFormElement(event.target)) return;

    const element = event.target;
    const isValid =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
        ? element.validity.valid
        : true;

    const formEvent = createFormValidationEvent(element, isValid);
    onEvent(formEvent);
  };

  document.addEventListener('invalid', handler, true);
  return () => document.removeEventListener('invalid', handler, true);
}

export function setupFormInteractionTracking(
  onEvent: EventCallback
): () => void {
  const cleanupFunctions: Array<() => void> = [
    setupFormFocusTracking(onEvent),
    setupFormBlurTracking(onEvent),
    setupFormInputTracking(onEvent),
    setupFormValidationTracking(onEvent),
  ];

  return () => {
    for (const cleanup of cleanupFunctions) {
      cleanup();
    }
  };
}
