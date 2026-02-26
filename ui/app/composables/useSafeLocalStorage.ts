export interface SafeLocalStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

/**
 * Client-safe wrapper around window.localStorage.
 * Returns no-op functions and null values on the server.
 */
export const useSafeLocalStorage = (): SafeLocalStorage => {
  const isClient = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

  const getItem = (key: string): string | null => {
    if (!isClient) return null
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  }

  const setItem = (key: string, value: string): void => {
    if (!isClient) return
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // noop
    }
  }

  const removeItem = (key: string): void => {
    if (!isClient) return
    try {
      window.localStorage.removeItem(key)
    } catch {
      // noop
    }
  }

  const clear = (): void => {
    if (!isClient) return
    try {
      window.localStorage.clear()
    } catch {
      // noop
    }
  }

  return {
    getItem,
    setItem,
    removeItem,
    clear,
  }
}
