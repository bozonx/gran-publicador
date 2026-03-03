import { toRaw } from 'vue';
// @ts-ignore
import { useRuntimeConfig } from '#app';

export function formatBytes(bytes?: number | string): string {
  if (!bytes || bytes === 0 || bytes === '0') return '0 B'
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  const val = b / Math.pow(k, i)
  return (val < 10 ? val.toFixed(2) : val.toFixed(1)) + ' ' + sizes[i]
}

export function getMediaIcon(type: string): string {
  switch (type.toUpperCase()) {
    case 'IMAGE':
      return 'i-heroicons-photo'
    case 'VIDEO':
      return 'i-heroicons-film'
    case 'AUDIO':
      return 'i-heroicons-musical-note'
    case 'DOCUMENT':
      return 'i-heroicons-document-text'
    case 'PDF':
      return 'i-heroicons-document-text'
    default:
      return 'i-heroicons-document'
  }
}

export function getExifData(media?: { meta?: any; fullMediaMeta?: any }) {
  return media?.meta?.exif || media?.fullMediaMeta?.exif || null
}

export function getResolution(media?: { width?: number; height?: number; meta?: any; fullMediaMeta?: any }) {
  if (!media) return null
  const { width, height } = media
  
  if (width && height) {
    return `${width} × ${height}`
  }
  
  // Fallback to EXIF if available
  const exif = getExifData(media)
  if (exif) {
    const exifW = exif.ImageWidth || exif.ExifImageWidth
    const exifH = exif.ImageHeight || exif.ExifImageHeight
    if (exifW && exifH) {
      return `${exifW} × ${exifH}`
    }
  }

  return null
}

/**
 * Converts EXIF GPS coordinates to decimal degrees
 */
function parseGpsCoordinate(value: any, ref?: string): number | null {
  if (typeof value === 'number') return ref === 'S' || ref === 'W' ? -value : value
  
  if (Array.isArray(value) && value.length >= 3) {
    // Handle [degrees, minutes, seconds]
    const d = typeof value[0] === 'number' ? value[0] : parseFloat(String(value[0]))
    const m = typeof value[1] === 'number' ? value[1] : parseFloat(String(value[1]))
    const s = typeof value[2] === 'number' ? value[2] : parseFloat(String(value[2]))
    
    if (isNaN(d) || isNaN(m) || isNaN(s)) return null
    
    let res = d + m / 60 + s / 3600
    if (ref === 'S' || ref === 'W') res = -res
    return res
  }
  
  return null
}

/**
 * Generates a Google Maps link from EXIF data if GPS coordinates are present
 */
export function getGpsLink(exif: any): string | null {
  if (!exif) return null

  const lat = parseGpsCoordinate(exif.GPSLatitude, exif.GPSLatitudeRef)
  const lon = parseGpsCoordinate(exif.GPSLongitude, exif.GPSLongitudeRef)

  if (lat !== null && lon !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
  }

  return null
}

export const getOptimizationStats = (media: { meta?: any; sizeBytes?: any; mimeType?: string }) => {
  if (!media?.meta) return null
  const { meta } = media
  
  // Try both camelCase and snake_case for the original size
  const original = meta.originalSize || meta.original_size
  // Use size from meta or the top-level sizeBytes
  const current = meta.size || media.sizeBytes
  
  if (!original || !current || Number(original) === Number(current)) return null

  const originalNum = Number(original)
  const currentNum = Number(current)
  const saved = originalNum - currentNum
  
  // Only show if there is actually some meaningful compression (> 1KB)
  if (saved < 1024) return null

  const percent = Math.round((saved / originalNum) * 100)
  const ratio = (originalNum / currentNum).toFixed(1)

  // Get quality and lossless from root or optimizationParams
  const params = meta.optimizationParams || {}
  const quality = meta.quality ?? params.quality
  const lossless = meta.lossless ?? params.lossless

  return {
    originalSize: formatBytes(originalNum),
    optimizedSize: formatBytes(currentNum),
    savedPercent: percent,
    ratio,
    quality,
    lossless,
    optimizedFormat: media.mimeType || meta.mimeType || meta.mime_type
  }
}

/**
 * Get URL for media file
 */
export function getMediaFileUrl(
  mediaId: string,
  token?: string,
  version?: string | number,
  download?: boolean,
): string {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase ? `${config.public.apiBase}/api/v1` : '/api/v1';
  let url = `${apiBase}/media/${mediaId}/file`;

  const params: string[] = [];

  if (token) {
    params.push(`token=${token}`);
  }

  if (version !== undefined && version !== null && String(version).length > 0) {
    params.push(`v=${encodeURIComponent(String(version))}`);
  }

  if (download) {
    params.push('download=1');
  }

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  return url;
}

/**
 * Get public URL for media file (no auth required)
 */
export function getPublicMediaUrl(mediaId: string, publicToken: string): string {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase ? `${config.public.apiBase}/api/v1` : '/api/v1';
  return `${apiBase}/media/p/${mediaId}/${publicToken}`;
}

/**
 * Get URL for media thumbnail
 */
export function getThumbnailUrl(
  mediaId: string,
  width?: number,
  height?: number,
  token?: string,
  version?: string | number,
): string {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase ? `${config.public.apiBase}/api/v1` : '/api/v1';
  let url = `${apiBase}/media/${mediaId}/thumbnail`;

  const params: string[] = [];
  if (width) params.push(`w=${width}`);
  if (height) params.push(`h=${height}`);
  if (token) params.push(`token=${token}`);
  if (version !== undefined && version !== null && String(version).length > 0)
    params.push(`v=${encodeURIComponent(String(version))}`);

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  return url;
}

export function getMediaThumbData(media: any, token?: string): any {
  const placeholderIcon =
    media.type === 'IMAGE'
      ? 'i-heroicons-photo'
      : media.type === 'VIDEO'
        ? 'i-heroicons-video-camera'
        : media.type === 'AUDIO'
          ? 'i-heroicons-musical-note'
          : 'i-heroicons-document';

  const placeholderText = media.filename || 'Untitled';

  const type = (media.type || '').toUpperCase();
  const storageType = (media.storageType || '').toUpperCase();
  const hasThumbnailInMeta = !!media.meta?.telegram?.thumbnailFileId;

  const canShowPreview =
    media.id &&
    (type === 'IMAGE' ||
      (storageType === 'TELEGRAM' &&
        (type === 'VIDEO' || type === 'DOCUMENT' || type === 'AUDIO') &&
        hasThumbnailInMeta));

  if (!canShowPreview) {
    return {
      src: null,
      srcset: null,
      isVideo: media.type === 'VIDEO',
      placeholderIcon,
      placeholderText,
    };
  }

  if (type === 'IMAGE') {
    if (storageType === 'STORAGE') {
      const src = getThumbnailUrl(media.id, 400, 400, token);
      const srcset = `${src} 1x, ${getThumbnailUrl(media.id, 800, 800, token)} 2x`;
      return {
        src,
        srcset,
        isVideo: false,
        placeholderIcon,
        placeholderText,
      };
    }

    if (storageType === 'URL') {
      return {
        src: media.storagePath,
        srcset: null,
        isVideo: false,
        placeholderIcon,
        placeholderText,
      };
    }

    return {
      src: getMediaFileUrl(media.id, token),
      srcset: null,
      isVideo: false,
      placeholderIcon,
      placeholderText,
    };
  }

  return {
    src: getThumbnailUrl(media.id, 400, 400, token),
    srcset: null,
    isVideo: type === 'VIDEO',
    placeholderIcon,
    placeholderText,
  };
}

export function getMediaLinksThumbDataLoose(
  mediaLinks: Array<{ media?: any; order: number }>,
  token?: string,
): { first: any | null; totalCount: number } {
  const firstMedia = mediaLinks[0]?.media;
  if (!firstMedia) {
    return { first: null, totalCount: mediaLinks.length };
  }

  return {
    first: getMediaThumbData(firstMedia, token),
    totalCount: mediaLinks.length,
  };
}
