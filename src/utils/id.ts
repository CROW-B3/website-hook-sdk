const SESSION_STORAGE_KEY = 'crow_session';

export interface SessionData {
  sessionId: string;
  expiresAt: number;
}

function generateUUID(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);

  // Set version to 4 (random) and variant bits
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;

  const segments = [
    Array.from(array.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    Array.from(array.slice(4, 6))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    Array.from(array.slice(6, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    Array.from(array.slice(8, 10))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    Array.from(array.slice(10, 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
  ];

  return `${segments[0]}-${segments[1]}-${segments[2]}-${segments[3]}-${segments[4]}`;
}

function tryGetItemFromLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function trySetItemInLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function isSessionExpired(sessionData: SessionData): boolean {
  return sessionData.expiresAt < Date.now();
}

function createNewSession(): SessionData {
  const sessionId = generateUUID();
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour from now

  return { sessionId, expiresAt };
}

function extendSessionExpiry(sessionData: SessionData): SessionData {
  return {
    sessionId: sessionData.sessionId,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
  };
}

function parseSessionData(data: string): SessionData | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.sessionId && typeof parsed.expiresAt === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function getOrCreateSessionId(): SessionData {
  const existingSessionString = tryGetItemFromLocalStorage(SESSION_STORAGE_KEY);
  let sessionData: SessionData | null = null;

  if (existingSessionString) {
    sessionData = parseSessionData(existingSessionString);
  }

  // If no valid session exists or it's expired, create a new one
  if (!sessionData || isSessionExpired(sessionData)) {
    sessionData = createNewSession();
  } else {
    // If valid session exists, extend its expiry
    sessionData = extendSessionExpiry(sessionData);
  }

  // Save updated session data to localStorage
  trySetItemInLocalStorage(SESSION_STORAGE_KEY, JSON.stringify(sessionData));

  return sessionData;
}

export function generateUniqueIdWithPrefix(prefix: string): string {
  const timestampBase36 = Date.now().toString(36);
  const randomStringBase36 = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestampBase36}${randomStringBase36}`;
}
