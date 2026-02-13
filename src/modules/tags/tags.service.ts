import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchTagsQueryDto } from './dto/index.js';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchTagsQueryDto) {
    const { q, projectId, userId, limit = 20 } = query;

    const normalizedQ = q ? String(q).trim().toLowerCase() : undefined;
    const take = Math.min(Math.max(Number(limit) || 20, 1), 50);

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

  /**
   * Helper to prepare many-to-many tags connection for Prisma
   */
  async prepareTagsConnectOrCreate(
    tags: string[],
    scope: { projectId?: string; userId?: string },
    isUpdate?: false,
  ): Promise<{ connectOrCreate: Array<{ where: any; create: any }> } | undefined>;
  async prepareTagsConnectOrCreate(
    tags: string[],
    scope: { projectId?: string; userId?: string },
    isUpdate: true,
  ): Promise<{ set: []; connectOrCreate?: Array<{ where: any; create: any }> }>;
  async prepareTagsConnectOrCreate(
    tags: string[],
    scope: { projectId?: string; userId?: string },
    isUpdate = false,
  ) {
    if (!tags || tags.length === 0) return isUpdate ? { set: [] } : undefined;

    const { projectId, userId } = scope;

    const hasProjectId = Boolean(projectId);
    const hasUserId = Boolean(userId);
    if (hasProjectId === hasUserId) {
      throw new BadRequestException('Exactly one of projectId or userId must be provided');
    }

    const normalizedTags = tags
      .map(t => String(t ?? '').trim())
      .filter(Boolean)
      .slice(0, 50);

    const connectOrCreate = normalizedTags.map(name => {
      const normalizedName = name.toLowerCase();

      const where = projectId
        ? { projectId_normalizedName: { projectId, normalizedName } }
        : { userId_normalizedName: { userId: userId as string, normalizedName } };

      const create = projectId
        ? { projectId, name, normalizedName }
        : { userId: userId as string, name, normalizedName };

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
}
