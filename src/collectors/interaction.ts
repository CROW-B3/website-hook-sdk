import type { Collector, CollectorContext } from './types';

const RAGE_CLICK_THRESHOLD = 3;
const RAGE_CLICK_WINDOW_MS = 1000;
const RAGE_CLICK_RADIUS_PX = 30;
const HOVER_THRESHOLD_MS = 500;

interface ClickRecord {
  x: number;
  y: number;
  timestamp: number;
}

function getElementPath(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;

  while (current && parts.length < 5) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2).join('.');
      if (classes) selector += `.${classes}`;
    }
    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

function getDataAttributes(element: HTMLElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.startsWith('data-')) {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

function getAccessibleName(element: HTMLElement): string | undefined {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelEl = document.getElementById(ariaLabelledBy);
    if (labelEl?.textContent) return labelEl.textContent.trim().substring(0, 200);
  }

  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
    const input = element as HTMLInputElement;
    if (input.placeholder) return input.placeholder;
    if (input.name) return input.name;
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label?.textContent) return label.textContent.trim().substring(0, 200);
  }

  if (element.tagName === 'IMG') {
    return (element as HTMLImageElement).alt || undefined;
  }

  const title = element.getAttribute('title');
  if (title) return title;

  return undefined;
}

function getVisibleText(element: HTMLElement): string | undefined {
  if (element.tagName === 'BUTTON' || element.tagName === 'A' || element.getAttribute('role') === 'button') {
    const text = element.innerText?.trim().substring(0, 200);
    if (text) return text;
  }

  const text = element.textContent?.trim().substring(0, 100);
  return text || undefined;
}

function getElementRole(element: HTMLElement): string | undefined {
  const explicitRole = element.getAttribute('role');
  if (explicitRole) return explicitRole;

  // Implicit roles
  const tagRoles: Record<string, string> = {
    BUTTON: 'button',
    A: 'link',
    INPUT: 'input',
    SELECT: 'combobox',
    TEXTAREA: 'textbox',
    NAV: 'navigation',
    MAIN: 'main',
    HEADER: 'banner',
    FOOTER: 'contentinfo',
    FORM: 'form',
    IMG: 'img',
  };

  return tagRoles[element.tagName] || undefined;
}

function getNearestHeading(element: HTMLElement): string | undefined {
  let current: HTMLElement | null = element;
  let depth = 0;

  while (current && depth < 10) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) {
        return sibling.textContent?.trim().substring(0, 200) || undefined;
      }
      sibling = sibling.previousElementSibling;
    }

    if (current.parentElement) {
      const heading: Element | null = current.parentElement.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading && heading !== current) {
        return heading.textContent?.trim().substring(0, 200) || undefined;
      }
    }

    current = current.parentElement;
    depth++;
  }

  return undefined;
}

function getElementDescriptor(element: HTMLElement): string {
  const role = getElementRole(element);
  const accessibleName = getAccessibleName(element);
  const visibleText = getVisibleText(element);

  const name = accessibleName || visibleText;

  if (role && name) return `${role}: "${name}"`;
  if (name) return `"${name}"`;
  if (role) return role;
  return element.tagName.toLowerCase();
}

function distanceBetween(a: ClickRecord, b: ClickRecord): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

export function createInteractionCollector(): Collector {
  let ctx: CollectorContext | null = null;
  let clickHandler: ((e: MouseEvent) => void) | null = null;
  let hoverEnterHandler: ((e: MouseEvent) => void) | null = null;
  let hoverLeaveHandler: ((e: MouseEvent) => void) | null = null;
  let focusInHandler: ((e: FocusEvent) => void) | null = null;
  let focusOutHandler: ((e: FocusEvent) => void) | null = null;

  const recentClicks: ClickRecord[] = [];
  const hoverStartTimes = new WeakMap<EventTarget, number>();

  function detectRageClick(x: number, y: number, timestamp: number): boolean {
    recentClicks.push({ x, y, timestamp });

    const cutoff = timestamp - RAGE_CLICK_WINDOW_MS;
    while (recentClicks.length > 0 && recentClicks[0].timestamp < cutoff) {
      recentClicks.shift();
    }

    if (recentClicks.length < RAGE_CLICK_THRESHOLD) return false;

    const nearbyClicks = recentClicks.filter(
      click => distanceBetween(click, { x, y, timestamp }) <= RAGE_CLICK_RADIUS_PX
    );

    return nearbyClicks.length >= RAGE_CLICK_THRESHOLD;
  }

  function buildClickEventData(
    event: MouseEvent,
    target: HTMLElement
  ): Record<string, unknown> {
    const elementPath = getElementPath(target);
    const dataAttributes = getDataAttributes(target);

    return {
      tagName: target.tagName,
      id: target.id || undefined,
      className: target.className || undefined,
      text: target.textContent?.substring(0, 100),
      href: (target as HTMLAnchorElement).href || undefined,
      x: event.clientX,
      y: event.clientY,
      pageX: event.pageX,
      pageY: event.pageY,
      elementPath,
      dataAttributes: Object.keys(dataAttributes).length > 0 ? dataAttributes : undefined,
      accessibleName: getAccessibleName(target),
      visibleText: getVisibleText(target),
      role: getElementRole(target),
      descriptor: getElementDescriptor(target),
      nearestHeading: getNearestHeading(target),
      ariaLabel: target.getAttribute('aria-label') || undefined,
      placeholder: (target as HTMLInputElement).placeholder || undefined,
      title: target.getAttribute('title') || undefined,
      alt: (target as HTMLImageElement).alt || undefined,
      scrollY: window.scrollY,
      scrollX: window.scrollX,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      autoCapture: true,
    };
  }

  function handleClick(event: MouseEvent): void {
    if (!ctx) return;

    const target = event.target as HTMLElement;
    const clickEventData = buildClickEventData(event, target);

    ctx.trackEvent('click', clickEventData);

    if (detectRageClick(event.clientX, event.clientY, Date.now())) {
      ctx.trackEvent('rage_click', {
        x: event.clientX,
        y: event.clientY,
        elementPath: clickEventData.elementPath,
        tagName: target.tagName,
        clickCount: recentClicks.length,
      });
      ctx.debug('Rage click detected', { elementPath: clickEventData.elementPath });
    }
  }

  function handleHoverEnter(event: MouseEvent): void {
    if (event.target) {
      hoverStartTimes.set(event.target, Date.now());
    }
  }

  function handleHoverLeave(event: MouseEvent): void {
    if (!ctx || !event.target) return;

    const startTime = hoverStartTimes.get(event.target);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    hoverStartTimes.delete(event.target);

    if (duration >= HOVER_THRESHOLD_MS) {
      const target = event.target as HTMLElement;
      ctx.trackEvent('hover', {
        tagName: target.tagName,
        id: target.id || undefined,
        elementPath: getElementPath(target),
        duration,
      });
    }
  }

  function handleFocusIn(event: FocusEvent): void {
    if (!ctx) return;

    const target = event.target as HTMLInputElement;
    if (!target || !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

    ctx.trackEvent('form_focus', {
      action: 'focus',
      tagName: target.tagName,
      type: target.type || undefined,
      name: target.name || undefined,
      id: target.id || undefined,
      elementPath: getElementPath(target),
      timestamp: Date.now(),
    });
  }

  function handleFocusOut(event: FocusEvent): void {
    if (!ctx) return;

    const target = event.target as HTMLInputElement;
    if (!target || !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

    ctx.trackEvent('form_focus', {
      action: 'blur',
      tagName: target.tagName,
      type: target.type || undefined,
      name: target.name || undefined,
      id: target.id || undefined,
      elementPath: getElementPath(target),
      timestamp: Date.now(),
    });
  }

  return {
    name: 'interaction',

    initialize(context: CollectorContext): void {
      ctx = context;

      clickHandler = handleClick;
      hoverEnterHandler = handleHoverEnter;
      hoverLeaveHandler = handleHoverLeave;
      focusInHandler = handleFocusIn;
      focusOutHandler = handleFocusOut;

      document.addEventListener('click', clickHandler);
      document.addEventListener('mouseenter', hoverEnterHandler, true);
      document.addEventListener('mouseleave', hoverLeaveHandler, true);
      document.addEventListener('focusin', focusInHandler);
      document.addEventListener('focusout', focusOutHandler);

      ctx.debug('Interaction collector initialized');
    },

    destroy(): void {
      if (clickHandler) document.removeEventListener('click', clickHandler);
      if (hoverEnterHandler) document.removeEventListener('mouseenter', hoverEnterHandler, true);
      if (hoverLeaveHandler) document.removeEventListener('mouseleave', hoverLeaveHandler, true);
      if (focusInHandler) document.removeEventListener('focusin', focusInHandler);
      if (focusOutHandler) document.removeEventListener('focusout', focusOutHandler);
      recentClicks.length = 0;
      ctx = null;
    },
  };
}
