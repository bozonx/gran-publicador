import { Injectable } from '@nestjs/common';
import { MediaType, StorageType } from '../../generated/prisma/index.js';

@Injectable()
export class ContentLibraryMapper {
  /**
   * Normalize tagObjects relation into a flat tags string array on a content item response.
   */
  public mapTags(tagObjects: any[]): string[] {
    return (tagObjects ?? []).map((t: any) => t.name).filter(Boolean);
  }

  /**
   * Normalize a single content item from Prisma to a clean response object.
   */
  public mapContentItem(item: any): any {
    if (!item) return null;

    return {
      ...item,
      tags: this.mapTags(item.tagObjects),
      groups: Array.isArray(item.groups)
        ? item.groups.map((g: any) => this.mapCollection(g.group))
        : [],
    };
  }

  /**
   * Normalize a collection (group) from Prisma to a clean response object.
   */
  public mapCollection(collection: any): any {
    if (!collection) return null;
    return {
      ...collection,
      config: this.parseJsonConfig(collection.config),
    };
  }

  /**
   * Safely parse JSON config.
   */
  private parseJsonConfig(config: any): any {
    if (typeof config === 'object' && config !== null) return config;
    try {
      return typeof config === 'string' ? JSON.parse(config) : {};
    } catch {
      return {};
    }
  }

  /**
   * Create Prisma include for content items listing.
   */
  public getItemsInclude(): any {
    return {
      tagObjects: true,
      media: { include: { media: true } },
      creator: { select: { id: true, fullName: true, avatarUrl: true } },
      groups: { include: { group: true } },
    };
  }

  /**
   * Map incoming media IDs from various DTO shapes to a consistent internal format.
   */
  public mapIncomingMediaIds(dto: {
    mediaIds?: string[];
    media?: Array<{ mediaId: string }>;
  }): string[] {
    if (Array.isArray(dto.mediaIds)) return dto.mediaIds;
    if (Array.isArray(dto.media)) return dto.media.map(m => m.mediaId);
    return [];
  }

  /**
   * Normalize incoming text.
   */
  public normalizeItemText(text?: unknown): string | null {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : '';
  }
}
