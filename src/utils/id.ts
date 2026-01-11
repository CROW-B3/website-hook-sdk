/**
 * Generate a unique ID with timestamp and random string
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}${randomStr}`;
}

/**
 * Get or create anonymous user ID
 */
export function getAnonymousId(): string {
  const key = 'crow_anonymous_id';

  // Try to get existing ID from localStorage
  try {
    const existingId = localStorage.getItem(key);
    if (existingId) {
      return existingId;
    }
  } catch (error) {
    // localStorage might not be available
  }

  // Generate new ID
  const newId = generateId('anon');

  // Try to save it
  try {
    localStorage.setItem(key, newId);
  } catch (error) {
    // Silently fail if localStorage is not available
  }

  return newId;
}

/**
 * Get or create session ID
 */
export function getSessionId(): string {
  const key = 'crow_session_id';
  const expiryKey = 'crow_session_expiry';
  const sessionTimeout = 30 * 60 * 1000; // 30 minutes

  try {
    const existingId = sessionStorage.getItem(key);
    const expiry = sessionStorage.getItem(expiryKey);

    if (existingId && expiry && Date.now() < Number.parseInt(expiry)) {
      // Session is still valid
      return existingId;
    }
  } catch (error) {
    // sessionStorage might not be available
  }

  // Generate new session ID
  const newId = generateId('sess');
  const newExpiry = (Date.now() + sessionTimeout).toString();

  try {
    sessionStorage.setItem(key, newId);
    sessionStorage.setItem(expiryKey, newExpiry);
  } catch (error) {
    // Silently fail if sessionStorage is not available
  }

  return newId;
}

/**
 * Extend session expiry
 */
export function extendSession(): void {
  const expiryKey = 'crow_session_expiry';
  const sessionTimeout = 30 * 60 * 1000; // 30 minutes

  try {
    const newExpiry = (Date.now() + sessionTimeout).toString();
    sessionStorage.setItem(expiryKey, newExpiry);
  } catch (error) {
    // Silently fail
  }
}
