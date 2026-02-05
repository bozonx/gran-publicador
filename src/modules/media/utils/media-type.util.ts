import { MediaType } from '../../../generated/prisma/index.js';

/**
 * Determines MediaType based on mimetype string.
 * @param mimetype The mimetype of the file (e.g., 'image/jpeg')
 * @returns The corresponding MediaType
 */
export function getMediaTypeFromMime(mimetype: string): MediaType {
  const mime = mimetype.toLowerCase();

  if (mime.startsWith('image/')) {
    return MediaType.IMAGE;
  }

  if (mime.startsWith('video/')) {
    return MediaType.VIDEO;
  }

  if (mime.startsWith('audio/')) {
    return MediaType.AUDIO;
  }

  return MediaType.DOCUMENT;
}
