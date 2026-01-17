const THIRTY_MINUTES_IN_MS = 30 * 60 * 1000;
const ANONYMOUS_ID_STORAGE_KEY = 'crow_anonymous_id';
const SESSION_ID_STORAGE_KEY = 'crow_session_id';
const SESSION_EXPIRY_STORAGE_KEY = 'crow_session_expiry';

export function generateUniqueIdWithPrefix(prefix: string): string {
  const timestampBase36 = Date.now().toString(36);
  const randomStringBase36 = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestampBase36}${randomStringBase36}`;
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

export function getOrCreateAnonymousId(): string {
  const existingAnonymousId = tryGetItemFromLocalStorage(
    ANONYMOUS_ID_STORAGE_KEY
  );
  if (existingAnonymousId) return existingAnonymousId;

  const newAnonymousId = generateUniqueIdWithPrefix('anon');
  trySetItemInLocalStorage(ANONYMOUS_ID_STORAGE_KEY, newAnonymousId);
  return newAnonymousId;
}

function tryGetItemFromSessionStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function trySetItemInSessionStorage(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    return;
  }
}

function isSessionStillValid(expiryTimestamp: string | null): boolean {
  if (!expiryTimestamp) return false;
  return Date.now() < Number.parseInt(expiryTimestamp);
}

function calculateSessionExpiryTimestamp(): string {
  return (Date.now() + THIRTY_MINUTES_IN_MS).toString();
}

export function getOrCreateSessionId(): string {
  const existingSessionId = tryGetItemFromSessionStorage(
    SESSION_ID_STORAGE_KEY
  );
  const sessionExpiry = tryGetItemFromSessionStorage(
    SESSION_EXPIRY_STORAGE_KEY
  );

  if (existingSessionId && isSessionStillValid(sessionExpiry)) {
    return existingSessionId;
  }

  const newSessionId = generateUniqueIdWithPrefix('sess');
  const newExpiryTimestamp = calculateSessionExpiryTimestamp();

  trySetItemInSessionStorage(SESSION_ID_STORAGE_KEY, newSessionId);
  trySetItemInSessionStorage(SESSION_EXPIRY_STORAGE_KEY, newExpiryTimestamp);

  return newSessionId;
}

export function extendCurrentSessionExpiry(): void {
  const newExpiryTimestamp = calculateSessionExpiryTimestamp();
  trySetItemInSessionStorage(SESSION_EXPIRY_STORAGE_KEY, newExpiryTimestamp);
}
