import { join, resolve } from 'path';

/**
 * Gets the MEDIA_DIR from environment variables.
 *
 * @returns The absolute path to the media directory.
 * @throws Error if MEDIA_DIR is not set.
 */
export function getMediaDir(): string {
  if (process.env.MEDIA_DIR) {
    // Resolve if relative, keep as-is if absolute
    return resolve(process.cwd(), process.env.MEDIA_DIR);
  }

  throw new Error('MEDIA_DIR environment variable is not set.');
}

/**
 * Gets the THUMBNAILS_DIR from environment variables.
 *
 * @returns The absolute path to the thumbnails directory.
 * @throws Error if THUMBNAILS_DIR is not set.
 */
export function getThumbnailsDir(): string {
  if (process.env.THUMBNAILS_DIR) {
    return resolve(process.cwd(), process.env.THUMBNAILS_DIR);
  }

  throw new Error('THUMBNAILS_DIR environment variable is not set.');
}
