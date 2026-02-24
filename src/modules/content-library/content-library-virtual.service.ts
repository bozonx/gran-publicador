import { Injectable } from '@nestjs/common';
import { PublicationsService } from '../publications/publications.service.js';
import { UnsplashService } from './unsplash.service.js';

@Injectable()
export class ContentLibraryVirtualService {
  constructor(
    private readonly publicationsService: PublicationsService,
    private readonly unsplashService: UnsplashService,
  ) {}

  public async listPublicationItems(options: {
    scope: 'personal' | 'project';
    projectId?: string;
    userId: string;
    search?: string;
    tags?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    withMedia?: boolean;
  }) {
    const { scope, projectId, userId, search, tags, sortBy, sortOrder, limit, offset, withMedia } = options;

    const parsedTags =
      typeof tags === 'string' && tags.length > 0 ? tags.split(',').filter(Boolean) : [];
    const sortField = sortBy === 'title' ? 'title' : 'chronology';

    const res =
      scope === 'project'
        ? await this.publicationsService.findAll(projectId as string, userId, {
            limit,
            offset,
            includeArchived: false,
            archivedOnly: false,
            search,
            sortBy: sortField,
            sortOrder,
            tags: parsedTags.length > 0 ? parsedTags : undefined,
            withMedia,
          })
        : await this.publicationsService.findAllForUser(userId, {
            limit,
            offset,
            includeArchived: false,
            archivedOnly: false,
            search,
            sortBy: sortField,
            sortOrder,
            tags: parsedTags.length > 0 ? parsedTags : undefined,
            withMedia,
          });

    const mappedItems = (res.items ?? []).map((p: any) => {
      const tagNames = Array.isArray(p.tags)
        ? p.tags
        : (p.tagObjects ?? []).map((t: any) => t.name).filter(Boolean);
      const media = Array.isArray(p.media)
        ? p.media
            .slice()
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
            .map((m: any, idx: number) => ({
              mediaId: m.mediaId ?? m.media?.id,
              hasSpoiler: m.hasSpoiler,
              order: m.order ?? idx,
              media: m.media,
            }))
        : [];

      return {
        id: p.id,
        title: p.title,
        text: p.content,
        tags: tagNames,
        createdAt: p.effectiveAt ?? p.createdAt,
        archivedAt: null,
        media,
        _virtual: {
          source: 'publication',
          publicationId: p.id,
        },
      };
    });

    return {
      items: mappedItems,
      total: res.total,
      totalUnfiltered: res.totalUnfiltered,
      limit,
      offset,
    };
  }

  public async listUnsplashItems(options: {
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const { search, limit, offset } = options;
    const query = typeof search === 'string' ? search.trim() : '';
    const page = Math.floor((offset ?? 0) / (limit ?? 20)) + 1;

    const res = await this.unsplashService.searchPhotos({
      query,
      page,
      perPage: limit ?? 20,
      orderBy: 'relevant',
    });

    const mappedItems = res.items.map(photo => {
      const title = photo.altDescription || photo.description || null;
      const note = photo.description;

      return {
        id: photo.id,
        title,
        text: null,
        note,
        tags: photo.tags.map(t => t.title).filter(Boolean),
        createdAt: photo.createdAt,
        archivedAt: null,
        media: [
          {
            order: 0,
            hasSpoiler: false,
            media: {
              id: `unsplash-${photo.id}`,
              type: 'IMAGE',
              storageType: 'URL',
              storagePath: photo.urls.small,
              filename: `unsplash-${photo.id}.jpg`,
            },
          },
        ],
        _virtual: {
          source: 'unsplash',
          unsplashId: photo.id,
          unsplashUser: photo.user.name,
          unsplashUsername: photo.user.username,
          unsplashUserUrl: photo.user.links.html,
          unsplashUrl: photo.links.html,
          thumbUrl: photo.urls.small,
          regularUrl: photo.urls.regular,
          likes: (photo as any).likes,
          views: (photo as any).views,
          downloads: (photo as any).downloads,
        },
      };
    });

    return {
      items: mappedItems,
      total: res.total,
      totalUnfiltered: res.total,
      limit,
      offset,
    };
  }
}
