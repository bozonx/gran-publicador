import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpConfig } from '../../config/http.config.js';
import { UnsplashConfig } from '../../config/unsplash.config.js';
import { requestJsonWithRetry } from '../../common/utils/http-request-with-retry.util.js';

export interface UnsplashPhoto {
  id: string;
  description: string | null;
  altDescription: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    username: string;
    links: { html: string };
  };
  tags: Array<{ title: string }>;
  createdAt: string;
  links: { html: string };
  views?: number;
  downloads?: number;
  likes?: number;
  width?: number;
  height?: number;
}

export interface UnsplashSearchResult {
  items: UnsplashPhoto[];
  total: number;
  totalPages: number;
}

@Injectable()
export class UnsplashService {
  private readonly logger = new Logger(UnsplashService.name);
  private readonly baseUrl = 'https://api.unsplash.com';

  private readonly httpConfig: HttpConfig;
  private readonly unsplashConfig: UnsplashConfig;

  constructor(private readonly configService: ConfigService) {
    this.httpConfig = this.configService.get<HttpConfig>('http')!;
    this.unsplashConfig = this.configService.get<UnsplashConfig>('unsplash')!;
  }

  public async searchPhotos(options: {
    query: string;
    page?: number;
    perPage?: number;
    orderBy?: 'relevant' | 'latest';
  }): Promise<UnsplashSearchResult> {
    const accessKey = this.configService.get<string>('UNSPLASH_ACCESS_KEY');
    if (!accessKey) {
      this.logger.warn('UNSPLASH_ACCESS_KEY is not configured');
      return { items: [], total: 0, totalPages: 0 };
    }

    const { query, page = 1, perPage = 20, orderBy = 'relevant' } = options;

    if (!query || query.trim().length === 0) {
      return { items: [], total: 0, totalPages: 0 };
    }

    const params = new URLSearchParams({
      query: query.trim(),
      page: String(page),
      per_page: String(perPage),
      order_by: orderBy,
    });

    const timeoutMs = (this.unsplashConfig.requestTimeoutSecs ?? 30) * 1000;
    const { statusCode, data } = await requestJsonWithRetry<{
      results: any[];
      total: number;
      total_pages: number;
    }>({
      url: `${this.baseUrl}/search/photos`,
      method: 'GET',
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
      query: Object.fromEntries(params.entries()),
      timeoutMs,
      retry: {
        maxAttempts: this.httpConfig.retryMaxAttempts,
        initialDelayMs: this.httpConfig.retryInitialDelayMs,
        maxDelayMs: this.httpConfig.retryMaxDelayMs,
      },
    });

    if (statusCode >= 400) {
      this.logger.error(`Unsplash API error: ${statusCode}`);
      return { items: [], total: 0, totalPages: 0 };
    }

    const items: UnsplashPhoto[] = (data.results ?? []).map((photo: any) => ({
      id: photo.id,
      description: photo.description ?? null,
      altDescription: photo.alt_description ?? null,
      urls: {
        raw: photo.urls?.raw ?? '',
        full: photo.urls?.full ?? '',
        regular: photo.urls?.regular ?? '',
        small: photo.urls?.small ?? '',
        thumb: photo.urls?.thumb ?? '',
      },
      user: {
        name: photo.user?.name ?? '',
        username: photo.user?.username ?? '',
        links: { html: photo.user?.links?.html ?? '' },
      },
      tags: (photo.tags ?? []).map((t: any) => ({ title: t.title ?? '' })),
      createdAt: photo.created_at ?? new Date().toISOString(),
      links: { html: photo.links?.html ?? '' },
      likes: photo.likes,
      views: photo.views,
      downloads: photo.downloads,
      width: photo.width,
      height: photo.height,
    }));

    return {
      items,
      total: data.total ?? 0,
      totalPages: data.total_pages ?? 0,
    };
  }
  public async getPhoto(photoId: string): Promise<UnsplashPhoto | null> {
    const accessKey = this.configService.get<string>('UNSPLASH_ACCESS_KEY');
    if (!accessKey) {
      this.logger.warn('UNSPLASH_ACCESS_KEY is not configured');
      return null;
    }

    const timeoutMs = (this.unsplashConfig.requestTimeoutSecs ?? 30) * 1000;
    const { statusCode, data: photo } = await requestJsonWithRetry<any>({
      url: `${this.baseUrl}/photos/${photoId}`,
      method: 'GET',
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
      timeoutMs,
      retry: {
        maxAttempts: this.httpConfig.retryMaxAttempts,
        initialDelayMs: this.httpConfig.retryInitialDelayMs,
        maxDelayMs: this.httpConfig.retryMaxDelayMs,
      },
    });

    if (statusCode >= 400) {
      this.logger.error(`Unsplash API error: ${statusCode}`);
      return null;
    }
    return {
      id: photo.id,
      description: photo.description ?? null,
      altDescription: photo.alt_description ?? null,
      urls: {
        raw: photo.urls?.raw ?? '',
        full: photo.urls?.full ?? '',
        regular: photo.urls?.regular ?? '',
        small: photo.urls?.small ?? '',
        thumb: photo.urls?.thumb ?? '',
      },
      user: {
        name: photo.user?.name ?? '',
        username: photo.user?.username ?? '',
        links: { html: photo.user?.links?.html ?? '' },
      },
      tags: (photo.tags ?? []).map((t: any) => ({ title: t.title ?? '' })),
      createdAt: photo.created_at ?? new Date().toISOString(),
      links: { html: photo.links?.html ?? '' },
      likes: photo.likes,
      views: photo.views,
      downloads: photo.downloads,
      width: photo.width,
      height: photo.height,
    };
  }
}
