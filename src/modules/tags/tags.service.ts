import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchTagsQueryDto } from './dto/index.js';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchTagsQueryDto) {
    const { q, projectId, userId, limit = 20 } = query;

    const normalizedQ = q ? String(q).trim().toLowerCase() : undefined;

    return this.prisma.tag.findMany({
      where: {
        AND: [
          // Cast to any until Prisma client is regenerated after schema update
          normalizedQ ? ({ normalizedName: { startsWith: normalizedQ } } as any) : {},
          projectId ? { projectId } : userId ? { userId, projectId: null } : {},
        ],
      },
      take: Number(limit),
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Helper to prepare many-to-many tags connection for Prisma
   */
  async prepareTagsConnectOrCreate(
    tags: string[],
    scope: { projectId?: string; userId?: string },
    isUpdate = false,
  ) {
    if (!tags || tags.length === 0) return isUpdate ? { set: [] } : {};

    const { projectId, userId } = scope;

    const normalizedTags = tags
      .map(t => String(t ?? '').trim())
      .filter(Boolean)
      .slice(0, 50);

    return {
      ...(isUpdate ? { set: [] } : {}), // Dissociate current tags only on update
      connectOrCreate: normalizedTags.map(name => {
        const normalizedName = name.toLowerCase();

        const where = projectId
          ? { projectId_normalizedName: { projectId, normalizedName } }
          : { userId_normalizedName: { userId: userId!, normalizedName } };

        const create = projectId
          ? { projectId, name, normalizedName }
          : { userId: userId!, name, normalizedName };

        return { where, create };
      }),
    };
  }
}
