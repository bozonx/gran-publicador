import { join, resolve } from 'path';

/**
 * Gets the MEDIA_DIR from environment variables.
 * Defaults to DATA_DIR/media if MEDIA_DIR is not explicitly set.
 *
 * @returns The absolute path to the media directory.
 * @throws Error if DATA_DIR is not set (and MEDIA_DIR is not set).
 */
export function getMediaDir(): string {
  if (process.env.MEDIA_DIR) {
      // Resolve if relative, keep as-is if absolute
      return resolve(process.cwd(), process.env.MEDIA_DIR);
  }

  const dataDir = process.env.DATA_DIR;
  if (!dataDir) {
    throw new Error('DATA_DIR environment variable is not set, and MEDIA_DIR is not set.');
  }

  // Default to {DATA_DIR}/media
  // resolve ensures that if dataDir is absolute, cwd is ignored
  return join(resolve(process.cwd(), dataDir), 'media');
}
/**
 * Gets the THUMBNAILS_DIR from environment variables.
 * Defaults to DATA_DIR/thumbnails if THUMBNAILS_DIR is not explicitly set.
 *
 * @returns The absolute path to the thumbnails directory.
 */
export function getThumbnailsDir(): string {
  if (process.env.THUMBNAILS_DIR) {
    return resolve(process.cwd(), process.env.THUMBNAILS_DIR);
  }

  const dataDir = process.env.DATA_DIR;
  if (!dataDir) {
    // If DATA_DIR is not set, we might still have MEDIA_DIR set. 
    // If MEDIA_DIR is set, we can use it as a base.
    if (process.env.MEDIA_DIR) {
        const mediaDir = resolve(process.cwd(), process.env.MEDIA_DIR);
        return join(resolve(mediaDir, '..'), 'thumbnails');
    }
    throw new Error('DATA_DIR environment variable is not set, and THUMBNAILS_DIR is not set.');
  }

  return join(resolve(process.cwd(), dataDir), 'thumbnails');
}
