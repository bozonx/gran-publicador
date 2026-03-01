import { useRuntimeConfig } from '#app';

export function useMediaUrls() {
  const config = useRuntimeConfig();
  const apiBase = config.public.apiBase ? `${config.public.apiBase}/api/v1` : '/api/v1';

  function getMediaFileUrl(
    mediaId: string,
    token?: string,
    version?: string | number,
    download?: boolean,
  ): string {
    let url = `${apiBase}/media/${mediaId}/file`;
    const params: string[] = [];

    if (token) params.push(`token=${token}`);
    if (version !== undefined && version !== null && String(version).length > 0) {
      params.push(`v=${encodeURIComponent(String(version))}`);
    }
    if (download) params.push('download=1');

    return params.length > 0 ? `${url}?${params.join('&')}` : url;
  }

  function getPublicMediaUrl(mediaId: string, publicToken: string): string {
    return `${apiBase}/media/p/${mediaId}/${publicToken}`;
  }

  function getThumbnailUrl(
    mediaId: string,
    width?: number,
    height?: number,
    token?: string,
    version?: string | number,
  ): string {
    let url = `${apiBase}/media/${mediaId}/thumbnail`;
    const params: string[] = [];
    if (width) params.push(`w=${width}`);
    if (height) params.push(`h=${height}`);
    if (token) params.push(`token=${token}`);
    if (version !== undefined && version !== null && String(version).length > 0)
      params.push(`v=${encodeURIComponent(String(version))}`);

    return params.length > 0 ? `${url}?${params.join('&')}` : url;
  }

  return {
    getMediaFileUrl,
    getPublicMediaUrl,
    getThumbnailUrl,
  };
}
