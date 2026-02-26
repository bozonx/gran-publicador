import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchTagsQueryDto } from './dto/index.js';
import { normalizeTags } from '../../common/utils/tags.util.js';

export type TagDomain = 'CONTENT_LIBRARY' | 'PUBLICATIONS';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSearchPrefix(q?: string): string | undefined {
    const [normalizedRaw] = normalizeTags([q ?? ''], {
      dedupe: false,
      dedupeCaseInsensitive: false,
      limit: 1,
    });
    const normalized = String(normalizedRaw ?? '').toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
  }

  private clampTake(limit?: number): number {
    return Math.min(Math.max(Number(limit) || 20, 1), 50);
  }

  async search(query: SearchTagsQueryDto) {
    const { q, projectId, userId, limit = 20 } = query;

    const normalizedQ = this.normalizeSearchPrefix(q);
    const take = this.clampTake(limit);

    return this.prisma.tag.findMany({
      where: {
        AND: [
          normalizedQ ? { normalizedName: { startsWith: normalizedQ } } : {},
          projectId ? { projectId } : { userId: userId! },
        ],
      },
      take,
      orderBy: { name: 'asc' },
    });
  }

  public async searchByDomain(options: {
    q?: string;
    projectId?: string;
    userId?: string;
    limit?: number;
    domain: TagDomain;
  }) {
    const normalizedQ = this.normalizeSearchPrefix(options.q);
    const take = this.clampTake(options.limit);

    return (this.prisma.tag as any).findMany({
      where: {
        AND: [
          normalizedQ ? { normalizedName: { startsWith: normalizedQ } } : {},
          options.projectId ? { projectId: options.projectId } : { userId: options.userId! },
          { domain: options.domain as any },
        ],
      },
      take,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Helper to prepare many-to-many tags connection for Prisma
   */
  async prepareTagsConnectOrCreate(
    tags: string[],
    scope: { projectId?: string; userId?: string },
    domain: TagDomain,
    isUpdate?: false,
  ): Promise<{ connectOrCreate: Array<{ where: any; create: any }> } | undefined>;
  async prepareTagsConnectOrCreate(
    tags: string[],
    scope: { projectId?: string; userId?: string },
    domain: TagDomain,
    isUpdate: true,
  ): Promise<{ set: []; connectOrCreate?: Array<{ where: any; create: any }> }>;
  async prepareTagsConnectOrCreate(
    tags: string[],
    scope: { projectId?: string; userId?: string },
    domain: TagDomain,
    isUpdate = false,
  ) {
    if (!tags || tags.length === 0) return isUpdate ? { set: [] } : undefined;

    const { projectId, userId } = scope;

    const hasProjectId = Boolean(projectId);
    const hasUserId = Boolean(userId);
    if (hasProjectId === hasUserId) {
      throw new BadRequestException('Exactly one of projectId or userId must be provided');
    }

    const normalizedTags = normalizeTags(tags, {
      dedupe: true,
      dedupeCaseInsensitive: true,
      limit: 50,
    });

    const connectOrCreate = normalizedTags.map(name => {
      const normalizedName = name.toLowerCase();

      const where = projectId
        ? { projectId_domain_normalizedName: { projectId, domain: domain as any, normalizedName } }
        : {
            userId_domain_normalizedName: {
              userId: userId as string,
              domain: domain as any,
              normalizedName,
            },
          };

      const create = projectId
        ? { projectId, name, normalizedName, domain: domain as any }
        : { userId: userId as string, name, normalizedName, domain: domain as any };

      return { where, create };
    });

    if (isUpdate) {
      return {
        set: [],
        connectOrCreate,
      };
    }

    return {
      connectOrCreate,
    };
  }

  /**
   * Remove tags that are not connected to any content items, publications or posts.
   * Useful for periodic maintenance.
   */
  async cleanupOrphanedTags() {
    return this.prisma.tag.deleteMany({
      where: {
        contentItems: { none: {} },
        publications: { none: {} },
        posts: { none: {} },
      },
    });
  }
}
