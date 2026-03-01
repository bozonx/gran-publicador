import { toRaw } from 'vue';
import { logger } from '~/utils/logger';

let autosaveCloneWarnedStructuredClone = false;
let autosaveCloneWarnedJsonClone = false;

export function getErrorStatus(err: unknown): number | null {
  const anyErr = err as any;
  const status =
    anyErr?.status ??
    anyErr?.response?.status ??
    anyErr?.response?._data?.statusCode ??
    anyErr?.data?.statusCode;
  return typeof status === 'number' ? status : null;
}

export function isRetryableStatus(status: number | null): boolean {
  if (status === null) return false;
  if (status === 0) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}

export function isNetworkError(err: unknown): boolean {
  const anyErr = err as any;
  const message = String(anyErr?.message ?? '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('econnreset')
  );
}

export function defaultIsEqual<T>(a: T, b: T): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function deepCloneOrNull<T>(obj: T): T | null {
  // We avoid structuredClone here because it often fails on Vue reactive Proxies.
  // JSON based clone is reliable for state that is intended for API storage (form data).
  try {
    return JSON.parse(JSON.stringify(toRaw(obj)));
  } catch (jsonCloneError) {
    if (!autosaveCloneWarnedJsonClone) {
      autosaveCloneWarnedJsonClone = true;
      logger.warn('Failed to deep clone autosave state, falling back to null baseline', jsonCloneError);
    }
    return null;
  }
}
