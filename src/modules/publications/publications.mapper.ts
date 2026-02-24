import { Injectable } from '@nestjs/common';
import { PostStatus, PublicationStatus } from '../../generated/prisma/index.js';

@Injectable()
export class PublicationsMapper {
  /**
   * Return meta object, ensuring it's an object.
   */
  public parseMetaJson(meta: any): Record<string, any> {
    return typeof meta === 'object' && meta !== null && !Array.isArray(meta)
      ? (meta as Record<string, any>)
      : {};
  }

  /**
   * Normalize tagObjects relation into a flat tags string array on a publication/post response.
   */
  public mapTags(tagObjects: Array<{ name: string } | any>): string[] {
    return (tagObjects ?? []).map((t: any) => t.name).filter(Boolean);
  }

  /**
   * Normalize a single publication from Prisma to a clean response object.
   */
  public mapPublication<T>(publication: T): T & { tags: string[]; posts: any[] } {
    if (!publication) return null as any;

    const p = publication as any;
    const normalizedPosts = Array.isArray(p.posts)
      ? p.posts.map((post: any) => this.mapPost(post))
      : p.posts;

    return {
      ...p,
      meta: this.parseMetaJson(p.meta),
      posts: normalizedPosts,
      tags: this.mapTags(p.tagObjects),
    };
  }

  /**
   * Normalize a single post from Prisma to a clean response object.
   */
  public mapPost(post: any): any {
    if (!post) return null;

    return {
      ...post,
      tags: this.mapTags(post.tagObjects),
    };
  }

  /**
   * Normalize author signature content by removing extra whitespaces and newlines.
   */
  public normalizeAuthorSignature(value: string): string {
    return value
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
