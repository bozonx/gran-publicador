import { logger } from '~/utils/logger';

export interface ApiOptions {
  headers?: Record<string, string>;
  onUploadProgress?: (progress: number) => void;
  [key: string]: any;
}

interface NormalizedApiError extends Error {
  status?: number;
  data?: unknown;
}

const toMessage = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  return 'Request failed';
};

const createApiError = (
  message: string,
  extras?: Partial<NormalizedApiError>,
): NormalizedApiError => {
  const err = new Error(message) as NormalizedApiError;
  if (extras?.status !== undefined) err.status = extras.status;
  if (extras?.data !== undefined) err.data = extras.data;
  return err;
};

const normalizeFetchError = (error: any): NormalizedApiError => {
  const status = error?.response?.status;
  const data = error?.data;

  const messageFromData =
    typeof data?.message === 'string'
      ? data.message
      : Array.isArray(data?.message)
        ? data.message.join(', ')
        : undefined;

  return createApiError(messageFromData || toMessage(error), { status, data });
};

export const useApi = () => {
  const config = useRuntimeConfig();
  const accessToken = useLocalStorage<string | null>('auth_access_token', null);
  const refreshToken = useLocalStorage<string | null>('auth_refresh_token', null);
  let refreshPromise: Promise<void> | null = null;

  // Base path for API, matching NestJS global prefix
  const rawApiBase = config.public.apiBase || '';
  const cleanApiBase = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;
  const apiBase = cleanApiBase ? `${cleanApiBase}/api/v1` : '/api/v1';

  const refreshTokens = async (): Promise<void> => {
    if (!refreshToken.value) {
      throw createApiError('No refresh token');
    }

    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const response = await $fetch<{ accessToken: string; refreshToken?: string }>(
            `${apiBase}/auth/refresh`,
            {
              method: 'POST',
              body: {
                refreshToken: refreshToken.value,
              },
            },
          );

          accessToken.value = response.accessToken;
          if (response.refreshToken) {
            refreshToken.value = response.refreshToken;
          }
        } catch (e) {
          logger.warn('Auth refresh failed', e);
          accessToken.value = null;
          refreshToken.value = null;
          throw normalizeFetchError(e);
        } finally {
          refreshPromise = null;
        }
      })();
    }

    await refreshPromise;
  };

  const isUnauthorizedError = (error: any): boolean => {
    const status = error?.response?.status ?? error?.status;
    return status === 401;
  };

  // XMLHttpRequest-based upload with progress tracking
  const uploadWithProgress = async <T>(
    url: string,
    body: FormData,
    options: ApiOptions = {},
    attempt = 0,
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (options.onUploadProgress) {
        xhr.upload.addEventListener('progress', event => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            options.onUploadProgress!(progress);
          }
        });
      }

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(xhr.responseText ? JSON.parse(xhr.responseText) : (undefined as T));
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
        } else if (xhr.status === 401) {
          if (attempt >= 1) {
            accessToken.value = null;
            refreshToken.value = null;
            reject(createApiError('Unauthorized', { status: 401 }));
            return;
          }

          refreshTokens()
            .then(() => uploadWithProgress<T>(url, body, options, attempt + 1))
            .then(resolve)
            .catch(reject);
        } else {
          try {
            const data = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
            const message =
              typeof data?.message === 'string'
                ? data.message
                : `Request failed with status ${xhr.status}`;
            reject(createApiError(message, { status: xhr.status, data }));
          } catch {
            reject(
              createApiError(`Request failed with status ${xhr.status}`, { status: xhr.status }),
            );
          }
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'));
      });

      // Open request
      xhr.open(String(options.method || 'POST'), `${apiBase}${url}`);

      // Set authorization header
      if (accessToken.value) {
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken.value}`);
      }

      if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          xhr.setRequestHeader(key, value);
        }
      }

      // Send request
      xhr.send(body);
    });
  };

  const request = async <T>(url: string, options: ApiOptions = {}, attempt = 0) => {
    // Use XMLHttpRequest for FormData with progress tracking
    if (options.body instanceof FormData && options.onUploadProgress) {
      return uploadWithProgress<T>(url, options.body, options);
    }

    // Use $fetch for regular requests
    const headers = {
      ...options.headers,
    };

    if (accessToken.value) {
      headers.Authorization = `Bearer ${accessToken.value}`;
    }

    try {
      return await $fetch<T>(`${apiBase}${url}`, {
        ...options,
        headers,
      });
    } catch (error: any) {
      if (isUnauthorizedError(error)) {
        if (attempt >= 1) {
          accessToken.value = null;
          refreshToken.value = null;
          throw normalizeFetchError(error);
        }

        try {
          await refreshTokens();
        } catch {
          throw normalizeFetchError(error);
        }

        return request<T>(url, options, attempt + 1);
      }

      throw normalizeFetchError(error);
    }
  };

  return {
    get: <T>(url: string, options: ApiOptions = {}) =>
      request<T>(url, { ...options, method: 'GET' }),
    post: <T>(url: string, body?: any, options: ApiOptions = {}) =>
      request<T>(url, { ...options, method: 'POST', body }),
    patch: <T>(url: string, body?: any, options: ApiOptions = {}) =>
      request<T>(url, { ...options, method: 'PATCH', body }),
    put: <T>(url: string, body?: any, options: ApiOptions = {}) =>
      request<T>(url, { ...options, method: 'PUT', body }),
    delete: <T>(url: string, options: ApiOptions = {}) =>
      request<T>(url, { ...options, method: 'DELETE' }),
  };
};
