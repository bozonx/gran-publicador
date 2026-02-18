import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private readonly configService: ConfigService) {}

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

    const response = await fetch(`${this.baseUrl}/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
    });

    if (!response.ok) {
      this.logger.error(`Unsplash API error: ${response.status} ${response.statusText}`);
      return { items: [], total: 0, totalPages: 0 };
    }

    const data = (await response.json()) as {
      results: any[];
      total: number;
      total_pages: number;
    };

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
    }));

    return {
      items,
      total: data.total ?? 0,
      totalPages: data.total_pages ?? 0,
    };
  }
}
