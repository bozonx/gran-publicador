import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/index.js';

import { DEFAULT_STALE_CHANNELS_DAYS } from '../../common/constants/global.constants.js';
import { normalizeLocale } from '../../common/utils/locale.util.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateChannelDto, UpdateChannelDto, ChannelResponseDto } from './dto/index.js';
import { PermissionKey } from '../../common/types/permissions.types.js';
import { ChannelsMapper } from './channels.mapper.js';
import { BaseCrudService } from '../../common/services/base-crud.service.js';
import { ChannelIssuesPattern } from './utils/channel-issues.util.js';
import { ChannelPreferencesUtil } from './utils/channel-preferences.util.js';
import { ChannelFiltersUtil } from './utils/channel-filters.util.js';

@Injectable()
export class ChannelsService extends BaseCrudService<ChannelResponseDto | any> {
  protected get modelDelegate() {
    return this.prisma.channel as any;
  }

  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private mapper: ChannelsMapper,
  ) {
    super();
  }

  private normalizeLanguage(code?: string | null): string {
    return normalizeLocale(code, { defaultLocale: 'en-US' });
  }

  private async validateChannelTemplateReferences(
    projectId: string,
    preferences: unknown,
  ): Promise<void> {
    const templates = ChannelPreferencesUtil.parse(preferences).templates;
    if (!templates || templates.length === 0) return;

    // Validate uniqueness by projectTemplateId (single adaptation per template)
    const tplIds = templates.map(t => t.projectTemplateId);
    const uniqueTplIds = new Set(tplIds);
    if (uniqueTplIds.size !== tplIds.length) {
      throw new BadRequestException(
        'Channel preferences contain duplicated projectTemplateId in templates',
      );
    }

    const projectTemplateIds = Array.from(uniqueTplIds);

    const existing = await this.prisma.projectTemplate.findMany({
      where: {
        projectId,
        id: { in: projectTemplateIds },
      },
      select: { id: true },
    });

    const existingSet = new Set(existing.map(t => t.id));
    const missing = projectTemplateIds.filter(id => !existingSet.has(id));
    if (missing.length > 0) {
      throw new BadRequestException('Channel preferences contain unknown projectTemplateId');
    }
  }

  public async upsertTemplateVariation(params: {
    channelId: string;
    userId: string;
    projectTemplateId: string;
    variation: { excluded?: boolean; overrides?: Record<string, unknown> };
  }) {
    const channel = await this.findOne(params.channelId, params.userId, true);
    if (params.variation.excluded === undefined && params.variation.overrides === undefined) {
      throw new BadRequestException('No variation fields provided');
    }

    // Use the new table for template variations
    await this.prisma.channelTemplateVariation.upsert({
      where: {
        channelId_projectTemplateId: {
          channelId: params.channelId,
          projectTemplateId: params.projectTemplateId,
        },
      },
      create: {
        channelId: params.channelId,
        projectTemplateId: params.projectTemplateId,
        excluded: params.variation.excluded ?? false,
        overrides: (params.variation.overrides ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        excluded: params.variation.excluded,
        overrides: params.variation.overrides as Prisma.InputJsonValue,
      },
    });

    return this.findOne(params.channelId, params.userId, true);
  }

  /**
   * Creates a new channel within a project.
   * Requires OWNER, ADMIN, or EDITOR role in the project.
   */
  public async create(
    userId: string,
    projectId: string,
    data: Omit<CreateChannelDto, 'projectId'>,
  ) {

    if (data.preferences) {
      await this.validateChannelTemplateReferences(projectId, data.preferences);
    }

    return this.prisma.channel.create({
      data: {
        projectId,
        socialMedia: data.socialMedia,
        name: data.name,
        note: data.note,
        channelIdentifier: data.channelIdentifier,
        language: this.normalizeLanguage(data.language),
        credentials: (data.credentials ?? {}) as Prisma.InputJsonValue,
        preferences: (data.preferences ?? {}) as Prisma.InputJsonValue,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Retrieves all channels for a given project.
   */
  public async findAllForProject(
    projectId: string,
    userId: string,
    options: { allowArchived?: boolean; isActive?: boolean; limit?: number } = {},
  ): Promise<ChannelResponseDto[]> {

    const publishedPostFilter = { status: 'PUBLISHED' as const };

    const channels = await this.prisma.channel.findMany({
      where: {
        projectId,
        ...(options.allowArchived ? {} : { archivedAt: null }),
        ...(options.isActive !== undefined ? { isActive: options.isActive } : {}),
      },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true },
        },
        templateVariations: true,
        posts: {
          where: { ...publishedPostFilter, publication: { archivedAt: null } },
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(options.limit ? { take: options.limit } : {}),
    });

    return channels.map(channel =>
      this.mapper.mapToDto(channel, {
        published: (channel as any).publishedPostsCount || 0,
        failed: (channel as any).failedPostsCount || 0,
      }),
    );
  }

  // ... (skip findAllForUser as it iterates projects)

  public async update(
    channelOrId: string | ChannelResponseDto,
    userId: string,
    data: UpdateChannelDto,
  ) {
    const channel =
      typeof channelOrId === 'string' ? await this.findOne(channelOrId, userId, true) : channelOrId;
    const id = channel.id;

    if (data.preferences) {
      await this.validateChannelTemplateReferences(channel.projectId, data.preferences);
    }

    const updateData: any = {
      name: data.name,
      note: data.note,
      channelIdentifier: data.channelIdentifier,
      credentials: data.credentials ? (data.credentials as Prisma.InputJsonValue) : undefined,
      preferences: data.preferences ? (data.preferences as Prisma.InputJsonValue) : undefined,
      isActive: data.isActive,
      tags: data.tags,
      language: data.language !== undefined ? this.normalizeLanguage(data.language) : undefined,
    };

    if (data.version !== undefined) {
      updateData.version = data.version; // Pass down the user's version to updateWithVersion instead of manually resolving here
    }

    return this.updateWithVersion(id, data.version, updateData);
  }

  public async remove(channelOrId: string | ChannelResponseDto, userId: string) {
    const channel =
      typeof channelOrId === 'string' ? await this.findOne(channelOrId, userId, true) : channelOrId;
    const id = channel.id;

    return this.prisma.$transaction(async tx => {
      // 1. Find all publications associated with this channel
      const linkedPublications = await tx.post.findMany({
        where: { channelId: id },
        select: { publicationId: true },
        distinct: ['publicationId'],
      });

      const linkedPubIds = linkedPublications.map(p => p.publicationId);

      if (linkedPubIds.length > 0) {
        // 2. Lock the publications to prevent concurrent modifications
        await tx.$queryRaw`SELECT 1 FROM "Publication" WHERE "id" IN (${Prisma.join(linkedPubIds)}) FOR UPDATE`;

        // 3. Check which of these publications have posts in OTHER channels
        const multiChannelPosts = await tx.post.findMany({
          where: {
            publicationId: { in: linkedPubIds },
            channelId: { not: id },
          },
          select: { publicationId: true },
          distinct: ['publicationId'],
        });

        const multiChannelPubIds = new Set(multiChannelPosts.map(p => p.publicationId));

        // 4. Identify "orphans" (publications that exist only in the channel being deleted)
        const pubsToDelete = linkedPubIds.filter(pid => !multiChannelPubIds.has(pid));

        // 5. Delete orphans
        if (pubsToDelete.length > 0) {
          await tx.publication.deleteMany({
            where: { id: { in: pubsToDelete } },
          });
        }
      }

      // 6. Delete the channel itself (Posts will be deleted via cascade in DB schema)
      return tx.channel.delete({ where: { id } });
    });
  }

  public async archive(id: string, userId: string): Promise<any> {
    const channel = await this.findOne(id, userId);

    return this.archiveRecord(id, userId);
  }

  public async unarchive(id: string, userId: string): Promise<any> {
    const channel = await this.findOne(id, userId, true);

    return this.unarchiveRecord(id, userId);
  }

  /**
   * Retrieves all channels for a given user across all projects.
   */
  public async findAllForUser(
    userId: string,
    filters: {
      search?: string;
      ownership?: 'all' | 'own' | 'guest';
      issueType?: 'all' | 'noCredentials' | 'failedPosts' | 'stale' | 'inactive' | 'problematic';
      socialMedia?: string;
      language?: string;
      sortBy?: 'alphabetical' | 'socialMedia' | 'language' | 'postsCount';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
      archivedOnly?: boolean;
      projectIds?: string[];
    } = {},
  ): Promise<{ items: ChannelResponseDto[]; total: number; totalUnfiltered: number }> {
    const validatedLimit = Math.min(filters.limit ?? 50, 1000);
    const offset = filters.offset ?? 0;

    // Check if user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    let userAllowedProjectIds: string[] = [];
    if (!user?.isAdmin) {
      const projectWhere: any = {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      };

      if (filters.ownership === 'own') {
        projectWhere.OR = [{ ownerId: userId }];
      } else if (filters.ownership === 'guest') {
        projectWhere.OR = [{ members: { some: { userId } }, ownerId: { not: userId } }];
      }

      const userProjects = await this.prisma.project.findMany({
        where: projectWhere,
        select: { id: true },
      });
      userAllowedProjectIds = userProjects.map(p => p.id);
    }
    
    const where = ChannelFiltersUtil.buildWhereClause(filters, user as { isAdmin: boolean }, userAllowedProjectIds, userId);
    
    // Quick exit if it's impossible to match any projects
    if ((where as any).id && (where as any).id.in && (where as any).id.in.length === 0) {
      return { items: [], total: 0, totalUnfiltered: 0 };
    }

    const orderBy = ChannelFiltersUtil.buildOrderBy(filters);
    const unfilteredWhere = ChannelFiltersUtil.buildUnfilteredWhere(filters, where, user as { isAdmin: boolean });

    const [channels, total, totalUnfiltered] = await Promise.all([
      this.prisma.channel.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true },
          },
          templateVariations: true,
          posts: {
            where: { status: 'PUBLISHED', publication: { archivedAt: null } },
            take: 1,
            orderBy: { publishedAt: 'desc' },
            select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
          },
          _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
        },
        orderBy,
        take: validatedLimit,
        skip: offset,
      }),
      this.prisma.channel.count({ where }),
      this.prisma.channel.count({ where: unfilteredWhere }),
    ]);

    const channelIds = channels.map(c => c.id);
    const failedPostCounts =
      channelIds.length > 0
        ? await this.prisma.post.groupBy({
            by: ['channelId'],
            where: { channelId: { in: channelIds }, status: 'FAILED' },
            _count: { id: true },
          })
        : [];

    const failedCountsMap = new Map<string, number>();
    failedPostCounts.forEach(pc => failedCountsMap.set(pc.channelId, pc._count.id));

    const items = channels.map(channel => {
      const failed = failedCountsMap.get(channel.id) ?? 0;
      return this.mapper.mapToDto(channel, {
        published: (channel as any)._count?.posts || 0,
        failed,
      });
    });

    return { items, total, totalUnfiltered };
  }

  public async findArchivedForProject(
    projectId: string,
    userId: string,
  ): Promise<ChannelResponseDto[]> {
    await this.permissions.checkProjectAccess(projectId, userId);
    const channels = await this.prisma.channel.findMany({
      where: { projectId, archivedAt: { not: null } },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true },
        },
        posts: {
          where: { status: 'PUBLISHED', publication: { archivedAt: null } },
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
      orderBy: { archivedAt: 'desc' },
    });

    return channels.map(channel => this.mapper.mapToDto(channel));
  }

  public async findArchivedForUser(userId: string): Promise<ChannelResponseDto[]> {
    const channels = await this.prisma.channel.findMany({
      where: {
        project: { members: { some: { userId } }, archivedAt: null },
        archivedAt: { not: null },
      },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true },
        },
        posts: {
          where: { status: 'PUBLISHED', publication: { archivedAt: null } },
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
      orderBy: { archivedAt: 'desc' },
    });

    return channels.map(channel => this.mapper.mapToDto(channel));
  }

  public async findOne(
    id: string,
    userId: string,
    allowArchived = false,
  ): Promise<ChannelResponseDto> {
    const channel = await this.prisma.channel.findUnique({
      where: { id, ...(allowArchived ? {} : { archivedAt: null }) },
      include: {
        project: {
          select: { id: true, name: true, archivedAt: true, preferences: true, ownerId: true },
        },
        posts: {
          where: { status: 'PUBLISHED', publication: { archivedAt: null } },
          take: 1,
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true, createdAt: true, id: true, publicationId: true },
        },
      },
    });

    if (!channel) throw new NotFoundException('Channel not found');

    const role = await this.permissions.getUserProjectRole(channel.projectId, userId);

    const pc = await this.prisma.post.groupBy({
      by: ['status'],
      where: { channelId: id, status: { in: ['PUBLISHED', 'FAILED'] } },
      _count: { id: true },
    });

    const publishedCount = pc.find(p => p.status === 'PUBLISHED')?._count.id ?? 0;
    const failedCount = pc.find(p => p.status === 'FAILED')?._count.id ?? 0;

    return this.mapper.mapToDto(
      channel,
      { published: publishedCount, failed: failedCount },
      role ?? undefined,
    );
  }
}
