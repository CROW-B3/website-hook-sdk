const SESSION_ID_STORAGE_KEY = 'crow_session_id';

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

export function getOrCreateSessionId(): string {
  const existingSessionId = tryGetItemFromLocalStorage(SESSION_ID_STORAGE_KEY);
  if (existingSessionId) return existingSessionId;

  const newSessionId = generateUniqueIdWithPrefix('sess');
  trySetItemInLocalStorage(SESSION_ID_STORAGE_KEY, newSessionId);

  return newSessionId;
}
