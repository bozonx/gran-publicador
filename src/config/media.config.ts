/**
 * Media Storage microservice configuration.
 * Provides configuration for integrating with the external Media Storage service.
 */

/**
 * Gets the Media Storage service URL from environment variables.
 *
 * @returns The Media Storage microservice URL.
 * @throws Error if MEDIA_STORAGE_SERVICE_URL is not set.
 */
export function getMediaStorageServiceUrl(): string {
  if (process.env.MEDIA_STORAGE_SERVICE_URL) {
    return process.env.MEDIA_STORAGE_SERVICE_URL;
  }

  throw new Error('MEDIA_STORAGE_SERVICE_URL environment variable is not set.');
}

/**
 * Gets the Media Storage Application ID.
 * Used to group files in the microservice.
 *
 * @returns App ID string (default: 'gran-publicador').
 */
export function getMediaStorageAppId(): string {
  return process.env.MEDIA_STORAGE_APP_ID || 'gran-publicador';
}

/**
 * Gets the Media Storage request timeout in seconds.
 *
 * @returns Timeout in seconds (default: 60).
 */
export function getMediaStorageTimeout(): number {
  const timeout = process.env.MEDIA_STORAGE_TIMEOUT_SECS;
  return timeout ? parseInt(timeout, 10) : 60;
}

/**
 * Gets the maximum file size in megabytes.
 *
 * @returns Max file size in MB (default: 100).
 */
export function getMediaStorageMaxFileSize(): number {
  const maxSize = process.env.MEDIA_STORAGE_MAX_FILE_SIZE_MB;
  return maxSize ? parseInt(maxSize, 10) : 100;
}

/**
 * Gets optional thumbnail quality setting.
 *
 * @returns Thumbnail quality (1-100) or undefined if not set.
 */
export function getThumbnailQuality(): number | undefined {
  const quality = process.env.THUMBNAIL_QUALITY;
  return quality ? parseInt(quality, 10) : undefined;
}
