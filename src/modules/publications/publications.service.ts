import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PublicationStatus,
  PostStatus,
  PostType,
  Prisma,
  SocialMedia,
  MediaType,
  StorageType,
} from '../../generated/prisma/index.js';

import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TagsService } from '../tags/tags.service.js';
import { ContentItemsService } from '../content-library/content-items.service.js';
import { UnsplashService } from '../content-library/unsplash.service.js';
import { PublicationQueryBuilder } from './utils/publication-query.builder.js';
import {
  CreatePublicationDto,
  UpdatePublicationDto,
  IssueType,
  OwnershipType,
  BulkOperationDto,
  BulkOperationType,
} from './dto/index.js';

import type { PublicationLlmChatDto } from './dto/publication-llm-chat.dto.js';
import { PermissionKey } from '../../common/types/permissions.types.js';
import { MediaService } from '../media/media.service.js';
import { PostSnapshotBuilderService } from '../social-posting/post-snapshot-builder.service.js';
import { LlmService } from '../llm/llm.service.js';
import { normalizeTags } from '../../common/utils/tags.util.js';
import { sanitizePublicationMarkdownForStorage } from '../../common/utils/publication-content-sanitizer.util.js';
import { PublicationsLlmService } from './publications-llm.service.js';
import { PublicationsMapper } from './publications.mapper.js';
import { PublicationsMediaService } from './publications-media.service.js';
import { PublicationsBulkService } from './publications-bulk.service.js';
import { ApplyLlmResultDto } from './dto/apply-llm-result.dto.js';
import { SocialPostingService } from '../social-posting/social-posting.service.js';
import { AuthorSignaturesService } from '../author-signatures/author-signatures.service.js';

@Injectable()
export class PublicationsService {
  private readonly logger = new Logger(PublicationsService.name);

  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private mediaService: MediaService,
    private snapshotBuilder: PostSnapshotBuilderService,
    private socialPostingService: SocialPostingService,
    private llmService: LlmService,
    private tagsService: TagsService,
    private contentItemsService: ContentItemsService,
    private unsplashService: UnsplashService,
    private llmChatService: PublicationsLlmService,
    private mapper: PublicationsMapper,
    private mediaSubService: PublicationsMediaService,
    private bulkSubService: PublicationsBulkService,
    private authorSignaturesService: AuthorSignaturesService,
  ) {}

  public async chatWithLlm(
    publicationId: string,
    userId: string,
    dto: PublicationLlmChatDto,
    options: { signal?: AbortSignal } = {},
  ) {
    const publication = await this.findOne(publicationId, userId);
    return this.llmChatService.chatWithLlm(publication, dto, options);
  }

  /**
   * Search for tags across publications project or user domain.
   */
  public async searchTags(
    userId: string,
    q: string,
    options: { projectId?: string; limit?: number },
  ) {
    if (options.projectId) {
      await this.permissions.checkProjectAccess(options.projectId, userId);
      const tags = await this.tagsService.searchByDomain({
        q,
        projectId: options.projectId,
        limit: options.limit,
        domain: 'PUBLICATIONS',
      });
      return (tags ?? []).map((t: any) => ({ name: t.name }));
    }

    const tags = await this.tagsService.searchByDomain({
      q,
      userId,
      limit: options.limit,
      domain: 'PUBLICATIONS',
    });
    return (tags ?? []).map((t: any) => ({ name: t.name }));
  }

  private readonly PUBLICATION_WITH_RELATIONS_INCLUDE = {
    creator: {
      select: {
        id: true,
        fullName: true,
        telegramUsername: true,
        avatarUrl: true,
      },
    },
    project: true,
    posts: {
      include: {
        channel: {
          include: {
            project: {
              select: {
                id: true,
                archivedAt: true,
              },
            },
          },
        },
        tagObjects: true,
      },
    },
    media: {
      include: {
        media: true,
      },
      orderBy: {
        order: 'asc' as const,
      },
    },
    contentItems: {
      include: {
        contentItem: true,
      },
      orderBy: {
        order: 'asc' as const,
      },
    },
    tagObjects: true,
  };

  /**
   * Create a new publication.
   */
  public async create(data: CreatePublicationDto, userId?: string) {
    if (userId && data.projectId) {
      await this.permissions.checkPermission(
        data.projectId,
        userId,
        PermissionKey.PUBLICATIONS_CREATE,
      );
    }

    const projectTemplateId = await this.resolveProjectTemplateId(
      data.projectId,
      data.language,
      data.postType,
      data.projectTemplateId,
    );

    const unsplashPhoto = data.unsplashId
      ? await this.unsplashService.getPhoto(data.unsplashId)
      : null;

    const sanitizedContent = sanitizePublicationMarkdownForStorage(data.content ?? '');

    const publication = await this.prisma.publication.create({
      data: {
        projectId: data.projectId,
        newsItemId: data.newsItemId ?? null,
        createdBy: userId ?? null,
        title: data.title,
        description: data.description,
        authorComment: data.authorComment,
        content: sanitizedContent,
        meta: data.meta ?? {},
        media: {
          create: await this.mediaSubService.prepareCreationMedia(data, unsplashPhoto, userId),
        },
        note: data.note,
        status: data.status ?? PublicationStatus.DRAFT,
        language: data.language,
        projectTemplateId,
        postType: data.postType ?? PostType.POST,
        postDate: data.postDate,
        scheduledAt: data.scheduledAt,
        contentItems: this.prepareContentItemsRelation(data),
        tagObjects: await this.tagsService.prepareTagsConnectOrCreate(
          normalizeTags(data.tags ?? []),
          { projectId: data.projectId },
          'PUBLICATIONS',
        ),
      },
      include: this.PUBLICATION_WITH_RELATIONS_INCLUDE,
    });

    await this.prisma.publication.update({
      where: { id: publication.id },
      data: { effectiveAt: publication.scheduledAt ?? publication.createdAt },
    });

    if (data.deleteOriginalContent && data.contentItemIds?.length) {
      await this.deleteOriginalContentItems(data.contentItemIds, userId);
    }

    this.logPublicationCreation(publication, data.projectId, userId);

    if (data.channelIds && data.channelIds.length > 0) {
      await this.handleInitialPostsCreation(publication, data, userId, projectTemplateId);
    }

    return this.normalizePublicationTags(publication);
  }

  public async findAll(
    projectId: string,
    userId: string,
    filters?: any, // Types simplified for brevity of rewrite
  ) {
    await this.permissions.checkPermission(projectId, userId, PermissionKey.PUBLICATIONS_READ);
    const where = PublicationQueryBuilder.buildWhere(userId, projectId, filters);
    const result = await this.paginatePublications(
      where,
      filters?.limit,
      filters?.offset,
      filters?.sortBy,
      filters?.sortOrder,
    );
    const totalUnfiltered = await this.prisma.publication.count({
      where: { projectId, archivedAt: null },
    });
    return { ...result, totalUnfiltered };
  }

  public async findAllForUser(userId: string, filters?: any) {
    const userProjects = await this.prisma.project.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: { id: true },
    });
    const userProjectIds = userProjects.map(p => p.id);
    if (userProjectIds.length === 0) return { items: [], total: 0, totalUnfiltered: 0 };
    const where = PublicationQueryBuilder.buildWhere(userId, undefined, filters, userProjectIds);
    const result = await this.paginatePublications(
      where,
      filters?.limit,
      filters?.offset,
      filters?.sortBy,
      filters?.sortOrder,
    );
    const totalUnfiltered = await this.prisma.publication.count({
      where: { projectId: { in: userProjectIds }, archivedAt: null },
    });
    return { ...result, totalUnfiltered };
  }

  public async findOne(id: string, userId: string) {
    const publication = await this.prisma.publication.findUnique({
      where: { id },
      include: this.PUBLICATION_WITH_RELATIONS_INCLUDE,
    });

    if (!publication) throw new NotFoundException('Publication not found');
    await this.permissions.checkProjectAccess(publication.projectId, userId);

    const relationItems = await this.prisma.publicationRelationItem.findMany({
      where: { publicationId: id },
      include: {
        group: {
          include: {
            items: {
              include: { publication: { include: { posts: { include: { channel: true } } } } },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    const relations = relationItems.map(ri => (ri as any).group);
    return this.normalizePublicationTags({
      ...publication,
      relations,
      meta: this.mapper.parseMetaJson(publication.meta),
    });
  }

  /**
   * Internal method to handle post resets when publication status changes.
   * Only resets non-published posts to avoid data loss.
   */
  private async handleStatusChange(
    publicationId: string,
    newStatus: PublicationStatus,
    previousStatus: PublicationStatus,
  ) {
    if (newStatus === previousStatus) return;

    // If moving to READY or DRAFT, reset pending/failed posts
    if (newStatus === PublicationStatus.DRAFT || newStatus === PublicationStatus.READY) {
      await this.prisma.post.updateMany({
        where: {
          publicationId,
          status: { not: PostStatus.PUBLISHED },
          publishedAt: null,
        },
        data: {
          status: PostStatus.PENDING,
          errorMessage: null,
          // We don't reset scheduledAt here anymore, usually controlled independently
          // or inherited from publication if needed.
        },
      });
    }

    // Handle snapshot building
    if (
      previousStatus === PublicationStatus.DRAFT &&
      (newStatus === PublicationStatus.READY || newStatus === PublicationStatus.SCHEDULED)
    ) {
      await this.snapshotBuilder.buildForPublication(publicationId);
    } else if (newStatus === PublicationStatus.DRAFT) {
      await this.snapshotBuilder.clearForPublication(publicationId);
    }
  }

  public async update(id: string, userId: string, data: UpdatePublicationDto) {
    const publication = await this.findOne(id, userId);
    const previousStatus = publication.status;

    if (publication.createdBy === userId) {
      await this.permissions.checkPermission(
        publication.projectId,
        userId,
        PermissionKey.PUBLICATIONS_UPDATE_OWN,
      );
    } else {
      await this.permissions.checkPermission(
        publication.projectId,
        userId,
        PermissionKey.PUBLICATIONS_UPDATE_ALL,
      );
    }

    if (data.status) {
      // Prevent user from setting system statuses directly via update
      const allowedUserStatuses: PublicationStatus[] = [
        PublicationStatus.DRAFT,
        PublicationStatus.READY,
        PublicationStatus.SCHEDULED,
      ];
      if (!allowedUserStatuses.includes(data.status)) {
        throw new BadRequestException(`Cannot manually set status to ${data.status}`);
      }
      await this.handleStatusChange(id, data.status, previousStatus);
    }

    // Snapshot invalidation: if publication is already in READY/SCHEDULED and content changes,
    // we must rebuild the snapshot so the worker gets the fresh content
    const isContentUpdated =
      data.title !== undefined ||
      data.content !== undefined ||
      data.tags !== undefined ||
      data.authorComment !== undefined ||
      data.language !== undefined ||
      data.postType !== undefined ||
      data.projectTemplateId !== undefined;
    const needsSnapshotRebuild =
      isContentUpdated &&
      (publication.status === PublicationStatus.READY ||
        publication.status === PublicationStatus.SCHEDULED);

    const sanitizedContent =
      data.content !== undefined
        ? sanitizePublicationMarkdownForStorage(data.content ?? '')
        : undefined;

    const updateData: Prisma.PublicationUpdateInput = {
      title: data.title,
      description: data.description,
      content: sanitizedContent,
      authorComment: data.authorComment,
      status: data.status,
      scheduledAt: data.scheduledAt,
      note: data.note,
      language: data.language,
      projectTemplate:
        data.projectTemplateId !== undefined
          ? data.projectTemplateId === null
            ? { disconnect: true }
            : { connect: { id: data.projectTemplateId } }
          : undefined,
    };

    if (data.tags !== undefined) {
      updateData.tagObjects = await this.tagsService.prepareTagsConnectOrCreate(
        normalizeTags(data.tags),
        { projectId: publication.projectId },
        'PUBLICATIONS',
        true,
      );
    }

    const updated = await this.prisma.publication.update({
      where: { id },
      data: updateData,
      include: this.PUBLICATION_WITH_RELATIONS_INCLUDE,
    });

    if (data.scheduledAt !== undefined || data.status !== undefined) {
      await this.refreshPublicationEffectiveAt(id);
    }

    if (needsSnapshotRebuild) {
      await this.snapshotBuilder.buildForPublication(id);
    }

    return this.normalizePublicationTags(updated);
  }

  /**
   * Instantly publish a publication, bypassing the scheduler
   */
  public async publishNow(id: string, userId: string) {
    const publication = await this.findOne(id, userId);

    if (publication.createdBy === userId) {
      await this.permissions.checkPermission(
        publication.projectId,
        userId,
        PermissionKey.PUBLICATIONS_UPDATE_OWN,
      );
    } else {
      await this.permissions.checkPermission(
        publication.projectId,
        userId,
        PermissionKey.PUBLICATIONS_UPDATE_ALL,
      );
    }

    if (
      publication.status === PublicationStatus.PROCESSING ||
      publication.status === PublicationStatus.PUBLISHED
    ) {
      throw new BadRequestException('Publication is already processing or published');
    }

    // 1. Build snapshot synchronously
    await this.snapshotBuilder.buildForPublication(id);

    // 2. Set to processing and enqueue
    // Enqueue automatically updates status to PROCESSING
    await this.socialPostingService.enqueuePublication(id, { skipLock: false, force: true });

    return this.findOne(id, userId);
  }

  public async applyLlmResult(id: string, userId: string, data: ApplyLlmResultDto) {
    const publication = await this.findOne(id, userId);

    const updateData: UpdatePublicationDto = {};
    if (data.publication) {
      if (data.publication.title !== undefined) updateData.title = data.publication.title;
      if (data.publication.description !== undefined)
        updateData.description = data.publication.description;
      if (data.publication.content !== undefined) updateData.content = data.publication.content;
      if (data.publication.tags !== undefined) updateData.tags = data.publication.tags;
    }

    if (data.meta) {
      updateData.meta = { ...this.mapper.parseMetaJson(publication.meta), ...data.meta };
    }

    // Use the existing update method logic but partially
    if (Object.keys(updateData).length > 0) {
      await this.update(id, userId, updateData);
    }

    if (data.posts?.length) {
      const posts = await this.prisma.post.findMany({
        where: { publicationId: id },
        select: { id: true, channelId: true },
      });

      const postMap = new Map(posts.map(p => [p.channelId, p.id]));

      for (const postData of data.posts) {
        const postId = postMap.get(postData.channelId);
        if (!postId) continue;

        const postUpdate: any = {};
        if (postData.content !== undefined) postUpdate.content = postData.content;
        if (postData.tags !== undefined) {
          postUpdate.tagObjects = await this.tagsService.prepareTagsConnectOrCreate(
            normalizeTags(postData.tags),
            { projectId: publication.projectId },
            'PUBLICATIONS',
            true,
          );
        }

        if (Object.keys(postUpdate).length > 0) {
          await this.prisma.post.update({
            where: { id: postId },
            data: postUpdate,
          });
        }
      }
    }

    return this.findOne(id, userId);
  }

  private async paginatePublications(
    where: any,
    limit = 50,
    offset = 0,
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const orderBy = PublicationQueryBuilder.getOrderBy(sortBy || 'chronology', sortOrder);
    const [items, total] = await Promise.all([
      this.prisma.publication.findMany({
        where,
        include: this.PUBLICATION_WITH_RELATIONS_INCLUDE,
        take: limit,
        skip: offset,
        orderBy,
      }),
      this.prisma.publication.count({ where }),
    ]);
    return { items: items.map(i => this.normalizePublicationTags(i)), total };
  }

  private normalizePublicationTags(publication: any) {
    return this.mapper.mapPublication(publication);
  }

  private async refreshPublicationEffectiveAt(publicationId: string) {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
      select: { id: true, createdAt: true, scheduledAt: true },
    });
    if (!publication) return;
    const publishedAgg = await this.prisma.post.aggregate({
      where: { publicationId, status: PostStatus.PUBLISHED, publishedAt: { not: null } },
      _max: { publishedAt: true },
    });
    const effectiveAt =
      publishedAgg._max.publishedAt ?? publication.scheduledAt ?? publication.createdAt;
    await this.prisma.publication.update({ where: { id: publicationId }, data: { effectiveAt } });
  }

  private async resolveProjectTemplateId(
    projectId: string,
    language: string,
    postType?: PostType,
    preferredId?: string,
  ): Promise<string | null> {
    if (preferredId) {
      const tpl = await this.prisma.projectTemplate.findFirst({
        where: { id: preferredId, projectId },
        select: { id: true },
      });
      if (tpl) return tpl.id;
    }
    const tpl = await this.prisma.projectTemplate.findFirst({
      where: {
        projectId,
        AND: [
          { OR: [{ language }, { language: null }] },
          { OR: [{ postType: postType ?? null }, { postType: null }] },
        ],
      },
      orderBy: { order: 'asc' },
    });
    return (
      tpl?.id ||
      (
        await this.prisma.projectTemplate.findFirst({
          where: { projectId },
          orderBy: { createdAt: 'asc' },
        })
      )?.id ||
      null
    );
  }

  private prepareContentItemsRelation(data: CreatePublicationDto) {
    if (!data.contentItemIds?.length) return undefined;
    return { create: data.contentItemIds.map((id, i) => ({ contentItemId: id, order: i })) };
  }

  private async deleteOriginalContentItems(ids: string[], userId?: string) {
    for (const id of ids) {
      try {
        await this.contentItemsService.remove(id, userId!);
      } catch (err: any) {
        this.logger.error(`Failed to delete original content item ${id}: ${err.message}`);
      }
    }
  }

  private logPublicationCreation(publication: any, projectId: string, userId?: string) {
    this.logger.log(
      `Publication created: ${publication.id} in project ${projectId} by user ${userId}`,
    );
  }

  private async handleInitialPostsCreation(
    publication: any,
    data: CreatePublicationDto,
    userId?: string,
    projectTemplateId?: string | null,
  ) {
    try {
      await this.createPostsFromPublication(
        publication.id,
        data.channelIds!,
        userId,
        data.scheduledAt || undefined,
        undefined,
        undefined,
        projectTemplateId || undefined,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to create initial posts for publication ${publication.id}: ${err.message}`,
      );
    }
  }

  public async createPostsFromPublication(
    publicationId: string,
    channelIds: string[],
    userId?: string,
    scheduledAt?: Date,
    authorSignatureId?: string,
    authorSignatureOverrides?: Record<string, string>,
    projectTemplateId?: string,
  ) {
    const channels = await this.prisma.channel.findMany({ where: { id: { in: channelIds } } });
    const posts = await Promise.all(
      channels.map(async channel => {
        let authorSignature = authorSignatureOverrides?.[channel.id];

        // If no direct override but we have a signatureId, resolve it by language
        if (!authorSignature && authorSignatureId) {
          authorSignature =
            (await this.authorSignaturesService.resolveVariantContent(
              authorSignatureId,
              channel.language,
            )) || undefined;
        }

        return this.prisma.post.create({
          data: {
            publicationId,
            channelId: channel.id,
            socialMedia: channel.socialMedia,
            status: PostStatus.PENDING,
            scheduledAt,
            authorSignature,
          },
        });
      }),
    );
    return { posts, warnings: [] };
  }

  public async remove(id: string, userId: string) {
    return this.bulkSubService.bulkOperation(
      userId,
      { ids: [id], operation: BulkOperationType.DELETE },
      id => this.refreshPublicationEffectiveAt(id),
    );
  }

  public async bulkOperation(userId: string, dto: BulkOperationDto) {
    return this.bulkSubService.bulkOperation(userId, dto, id =>
      this.refreshPublicationEffectiveAt(id),
    );
  }

  public async addMedia(publicationId: string, userId: string, media: any[]) {
    return this.mediaSubService.addMedia(publicationId, userId, media);
  }

  public async removeMedia(publicationId: string, userId: string, mediaId: string) {
    return this.mediaSubService.removeMedia(publicationId, userId, mediaId);
  }

  public async reorderMedia(
    publicationId: string,
    userId: string,
    mediaOrder: Array<{ id: string; order: number }>,
  ) {
    return this.mediaSubService.reorderMedia(publicationId, userId, mediaOrder);
  }

  public async updateMediaLink(
    publicationId: string,
    userId: string,
    mediaLinkId: string,
    data: { hasSpoiler?: boolean; order?: number },
  ) {
    return this.mediaSubService.updateMediaLink(publicationId, userId, mediaLinkId, data);
  }

  public async copy(id: string, targetProjectId: string, userId: string) {
    // Basic copy implementation if not in sub-service
    const original = await this.findOne(id, userId);
    const {
      id: _,
      creator: __,
      project: ___,
      posts: ____,
      media: _____,
      contentItems: ______,
      tagObjects: _______,
      relations: ________,
      ...data
    } = original;

    // Simplistic copy for now, should ideally be more comprehensive
    return this.create(
      {
        ...data,
        projectId: targetProjectId,
        tags: original.tagObjects.map((t: any) => t.name),
      },
      userId,
    );
  }
}
