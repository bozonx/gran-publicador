import { request } from 'undici';

import { HTTP_RETRY_JITTER_RATIO } from '../constants/global.constants.js';

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

const buildUrlWithQuery = (url: string, query?: Record<string, unknown>): string => {
  if (!query || Object.keys(query).length === 0) return url;

  const u = new URL(url);

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined || rawValue === null) continue;

    if (Array.isArray(rawValue)) {
      for (const v of rawValue) {
        if (v === undefined || v === null) continue;
        u.searchParams.append(key, String(v));
      }
      continue;
    }

    u.searchParams.set(key, String(rawValue));
  }

  return u.toString();
};

export class HttpRetryableStatusError extends Error {
  public readonly statusCode: number;
  public readonly responseText: string;

  constructor(params: { statusCode: number; responseText: string; message?: string }) {
    super(params.message ?? `Retryable HTTP status: ${params.statusCode}`);
    this.statusCode = params.statusCode;
    this.responseText = params.responseText;
  }
}

export const sleep = async (ms: number): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, ms));
};

export const applyJitter = (baseDelayMs: number): number => {
  const ratio = HTTP_RETRY_JITTER_RATIO;
  if (!ratio || ratio <= 0) return baseDelayMs;

  const delta = baseDelayMs * ratio;
  const jittered = baseDelayMs + (Math.random() * 2 - 1) * delta;

  return Math.max(0, Math.round(jittered));
};

export const resolveBackoffDelayMs = (params: {
  attempt: number;
  initialDelayMs: number;
  maxDelayMs: number;
}): number => {
  const exp = Math.pow(2, Math.max(0, params.attempt - 1));
  const base = Math.min(params.initialDelayMs * exp, params.maxDelayMs);
  return applyJitter(base);
};

export const isRetryableStatusCode = (statusCode: number): boolean => {
  return statusCode === 429 || statusCode >= 500;
};

export const isTimeoutError = (error: unknown): boolean => {
  const err = error as { name?: string; code?: string };
  return (
    err?.name === 'TimeoutError' ||
    err?.code === 'UND_ERR_HEADERS_TIMEOUT' ||
    err?.code === 'UND_ERR_BODY_TIMEOUT'
  );
};

export const isConnectionError = (error: unknown): boolean => {
  const err = error as { code?: string; cause?: { code?: string } };
  return (
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ENOTFOUND' ||
    err?.code === 'ECONNRESET' ||
    err?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    err?.cause?.code === 'ECONNREFUSED' ||
    err?.cause?.code === 'ENOTFOUND'
  );
};

export const requestJsonWithRetry = async <T>(params: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: any;
  timeoutMs: number;
  retry: RetryConfig;
  shouldRetryOnStatusCode?: (statusCode: number) => boolean;
}): Promise<{ statusCode: number; data: T; headers: Record<string, string | string[]> }> => {
  const shouldRetryOnStatusCode =
    params.shouldRetryOnStatusCode ?? ((status: number) => isRetryableStatusCode(status));

  const finalUrl = buildUrlWithQuery(params.url, params.query);

  let lastError: unknown;

  for (let attempt = 1; attempt <= params.retry.maxAttempts; attempt++) {
    try {
      const response = await request(finalUrl, {
        method: params.method,
        headers: params.headers,
        body: params.body,
        headersTimeout: params.timeoutMs,
        bodyTimeout: params.timeoutMs,
      });

      if (shouldRetryOnStatusCode(response.statusCode)) {
        const responseText = await response.body.text();
        throw new HttpRetryableStatusError({
          statusCode: response.statusCode,
          responseText,
        });
      }

      const data = (await response.body.json()) as T;
      return {
        statusCode: response.statusCode,
        data,
        headers: response.headers as any,
      };
    } catch (error) {
      lastError = error;

      if (attempt >= params.retry.maxAttempts) {
        throw error;
      }

      const delayMs = resolveBackoffDelayMs({
        attempt,
        initialDelayMs: params.retry.initialDelayMs,
        maxDelayMs: params.retry.maxDelayMs,
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
};

export const requestTextWithRetry = async (params: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: any;
  timeoutMs: number;
  retry: RetryConfig;
  shouldRetryOnStatusCode?: (statusCode: number) => boolean;
}): Promise<{ statusCode: number; text: string; headers: Record<string, string | string[]> }> => {
  const shouldRetryOnStatusCode =
    params.shouldRetryOnStatusCode ?? ((status: number) => isRetryableStatusCode(status));

  const finalUrl = buildUrlWithQuery(params.url, params.query);

  let lastError: unknown;

  for (let attempt = 1; attempt <= params.retry.maxAttempts; attempt++) {
    try {
      const response = await request(finalUrl, {
        method: params.method,
        headers: params.headers,
        body: params.body,
        headersTimeout: params.timeoutMs,
        bodyTimeout: params.timeoutMs,
      });

      const text = await response.body.text();

      if (shouldRetryOnStatusCode(response.statusCode)) {
        throw new HttpRetryableStatusError({
          statusCode: response.statusCode,
          responseText: text,
        });
      }

      return {
        statusCode: response.statusCode,
        text,
        headers: response.headers as any,
      };
    } catch (error) {
      lastError = error;

      if (attempt >= params.retry.maxAttempts) {
        throw error;
      }

      const delayMs = resolveBackoffDelayMs({
        attempt,
        initialDelayMs: params.retry.initialDelayMs,
        maxDelayMs: params.retry.maxDelayMs,
      });

      await sleep(delayMs);
    }
  }

  throw lastError;
};
