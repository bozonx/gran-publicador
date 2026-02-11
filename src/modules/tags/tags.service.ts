import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchTagsQueryDto } from './dto/index.js';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchTagsQueryDto) {
    const { q, projectId, userId, limit = 20 } = query;

    return this.prisma.tag.findMany({
      where: {
        AND: [
          q ? { name: { contains: q, mode: 'insensitive' } } : {},
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
  async prepareTagsConnectOrCreate(tags: string[], scope: { projectId?: string; userId?: string }) {
    if (!tags || tags.length === 0) return { set: [] };

    const { projectId, userId } = scope;

    return {
      set: [], // Dissociate current tags
      connectOrCreate: tags.map(name => {
        const normalizedName = name.trim();
        const where = projectId
          ? { projectId_name: { projectId, name: normalizedName } }
          : { userId_name: { userId: userId!, name: normalizedName } };

        const create = projectId
          ? { projectId, name: normalizedName }
          : { userId: userId!, name: normalizedName };

        return { where, create };
      }),
    };
  }
}
