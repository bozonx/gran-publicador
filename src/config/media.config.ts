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
 * Gets optional image compression settings to pass to Media Storage.
 * If not set, microservice defaults will be used.
 *
 * @returns Compression options object or undefined if no options are set.
 */
export function getImageCompressionOptions(): Record<string, any> | undefined {
  const options: Record<string, any> = {};

  if (process.env.IMAGE_COMPRESSION_FORMAT) {
    options.format = process.env.IMAGE_COMPRESSION_FORMAT;
  }

  if (process.env.IMAGE_COMPRESSION_MAX_DIMENSION) {
    options.maxDimension = parseInt(process.env.IMAGE_COMPRESSION_MAX_DIMENSION, 10);
  }

  if (process.env.IMAGE_COMPRESSION_STRIP_METADATA) {
    options.stripMetadata = process.env.IMAGE_COMPRESSION_STRIP_METADATA === 'true';
  }

  if (process.env.IMAGE_COMPRESSION_LOSSLESS) {
    options.lossless = process.env.IMAGE_COMPRESSION_LOSSLESS === 'true';
  }

  if (process.env.IMAGE_COMPRESSION_QUALITY) {
    options.quality = parseInt(process.env.IMAGE_COMPRESSION_QUALITY, 10);
  }

  if (process.env.IMAGE_COMPRESSION_AVIF_CHROMA_SUBSAMPLING) {
    options.avifChromaSubsampling = process.env.IMAGE_COMPRESSION_AVIF_CHROMA_SUBSAMPLING;
  }

  return Object.keys(options).length > 0 ? options : undefined;
}

/**
 * Gets optional thumbnail max dimension setting.
 *
 * @returns Max dimension in pixels or undefined if not set.
 */
export function getThumbnailMaxDimension(): number | undefined {
  const dim = process.env.THUMBNAIL_MAX_DIMENSION;
  return dim ? parseInt(dim, 10) : undefined;
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
