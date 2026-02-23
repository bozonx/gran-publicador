/**
 * Default number of days after which a channel is considered stale if not configured otherwise.
 */
export const DEFAULT_STALE_CHANNELS_DAYS = 3;

/**
 * Default timeout for microservice and external API requests in milliseconds.
 */
export const DEFAULT_MICROSERVICE_TIMEOUT_MS = 60000;

/**
 * Jitter ratio applied to generic HTTP retry delays.
 * Example: 0.2 means ±20%.
 */
export const HTTP_RETRY_JITTER_RATIO = 0.2;

/**
 * Telegram media proxy retry count (number of retries after the first attempt).
 */
export const TELEGRAM_MEDIA_PROXY_RETRY_COUNT = 2;

/**
 * Delay between Telegram media proxy retries in milliseconds.
 */
export const TELEGRAM_MEDIA_PROXY_RETRY_DELAY_MS = 2000;

/**
 * Jitter ratio applied to Telegram media proxy retry delays.
 * Example: 0.2 means ±20%.
 */
export const TELEGRAM_MEDIA_PROXY_RETRY_JITTER_RATIO = 0.2;

/**
 * Default LLM context limit in characters for non-article content.
 */
export const DEFAULT_LLM_CONTEXT_LIMIT_CHARS = 10000;

/**
 * Default timeout for LLM requests in seconds (fallback if not configured).
 */
export const DEFAULT_LLM_TIMEOUT_SECS = 120;
