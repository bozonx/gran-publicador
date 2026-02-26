import { parse } from 'cookie';

/**
 * Gets a cookie value from a cookie header string.
 * @param cookieHeader The raw cookie header string.
 * @param key The cookie name.
 * @returns The cookie value or null if not found.
 */
export const getCookieValue = (cookieHeader: unknown, key: string): string | null => {
  if (typeof cookieHeader !== 'string' || !cookieHeader) {
    return null;
  }

  try {
    const cookies = parse(cookieHeader);
    return cookies[key] || null;
  } catch (error) {
    return null;
  }
};
