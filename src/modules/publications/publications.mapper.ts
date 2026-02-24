import { Injectable } from '@nestjs/common';
import { PostStatus, PublicationStatus } from '../../generated/prisma/index.js';

@Injectable()
export class PublicationsMapper {
  /**
   * Return meta object, ensuring it's an object.
   */
  public parseMetaJson(meta: any): Record<string, any> {
    return typeof meta === 'object' && meta !== null ? meta : {};
  }

  /**
   * Normalize tagObjects relation into a flat tags string array on a publication/post response.
   */
  public mapTags(tagObjects: any[]): string[] {
    return (tagObjects ?? []).map((t: any) => t.name).filter(Boolean);
  }

  /**
   * Normalize a single publication from Prisma to a clean response object.
   */
  public mapPublication(publication: any): any {
    if (!publication) return null;

    const normalizedPosts = Array.isArray(publication.posts)
      ? publication.posts.map((post: any) => this.mapPost(post))
      : publication.posts;

    return {
      ...publication,
      meta: this.parseMetaJson(publication.meta),
      posts: normalizedPosts,
      tags: this.mapTags(publication.tagObjects),
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
