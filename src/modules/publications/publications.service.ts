import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PublicationStatus, PostStatus, PostType, Prisma, ProjectRole, SocialMedia } from '../../generated/prisma/client.js';
import { randomUUID } from 'node:crypto';

import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePublicationDto, UpdatePublicationDto, IssueType, OwnershipType } from './dto/index.js';

@Injectable()
export class PublicationsService {
  private readonly logger = new Logger(PublicationsService.name);

  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
  ) { }

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
              }
            }
          }
        },
      },
    },
    media: {
      include: {
        media: true,
      },
      orderBy: {
        order: 'asc' as const
      }
    }
  };

  /**
   * Build WHERE clause for publication queries with filters.
   * Extracted to avoid code duplication between findAll and findAllForUser.
   */
  private buildWhereClause(
    filters: {
      status?: PublicationStatus | PublicationStatus[];
      includeArchived?: boolean;
      channelId?: string;
      socialMedia?: SocialMedia;
      ownership?: OwnershipType;
      issueType?: IssueType;
      search?: string;
      language?: string;
    },
    userId: string,
    projectId?: string,
  ): Prisma.PublicationWhereInput {
    const where: Prisma.PublicationWhereInput = {};
    const conditions: Prisma.PublicationWhereInput[] = [];

    // Project filter (if provided)
    if (projectId) {
      where.projectId = projectId;
      // Archive filter for project-specific queries
      if (!filters?.includeArchived) {
        where.archivedAt = null;
        where.project = { archivedAt: null };
      }
    } else {
      // For user queries, filter by membership
      where.project = {
        members: {
          some: { userId },
        },
        archivedAt: null,
      };
      if (!filters?.includeArchived) {
        where.archivedAt = null;
      }
    }

    // Status filter
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        where.status = { in: filters.status };
      } else {
        where.status = filters.status;
      }
    }

    // Filter by channel (publications that have posts in this channel)
    if (filters?.channelId) {
      conditions.push({
        posts: {
          some: {
            channelId: filters.channelId,
          },
        },
      });
    }

    // Filter by Social Media
    if (filters?.socialMedia) {
      conditions.push({
        posts: {
          some: {
            channel: {
              socialMedia: filters.socialMedia,
            },
          },
        },
      });
    }

    // Filter by Ownership
    if (filters?.ownership) {
      if (filters.ownership === OwnershipType.OWN) {
        where.createdBy = userId;
      } else if (filters.ownership === OwnershipType.NOT_OWN) {
        where.createdBy = { not: userId };
      }
    }

    // Filter by Issue Type
    if (filters?.issueType) {
      if (filters.issueType === IssueType.FAILED) {
        conditions.push({
          OR: [
            { status: PublicationStatus.FAILED },
            { posts: { some: { status: PostStatus.FAILED } } }
          ]
        });
      } else if (filters.issueType === IssueType.PARTIAL) {
        where.status = PublicationStatus.PARTIAL;
      } else if (filters.issueType === IssueType.EXPIRED) {
        where.status = PublicationStatus.EXPIRED;
      }
    }

    // Text search across title, description, and content
    // Note: SQLite LIKE is case-sensitive for non-ASCII (Cyrillic) characters
    // For true case-insensitive search, would need LOWER() in raw SQL
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { description: { contains: filters.search } },
        { content: { contains: filters.search } },
      ];
    }

    // Filter by language
    if (filters?.language) {
      where.language = filters.language;
    }

    // Apply AND conditions
    if (conditions.length > 0) {
      where.AND = conditions;
    }

    return where;
  }

  /**
   * Parse meta JSON string to object, handling nested JSON strings.
   */
  private parseMetaJson(meta: string | null | undefined): Record<string, any> {
    if (!meta) return {};
    
    try {
      let parsed = JSON.parse(meta);
      
      // Handle case where meta is double-encoded (e.g., '"{\"key\":\"value\"}"')
      const maxDepth = 5;
      let depth = 0;
      while (typeof parsed === 'string' && depth < maxDepth) {
        try {
          const trimmed = parsed.trim();
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
              (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            parsed = JSON.parse(parsed);
            depth++;
          } else {
            break;
          }
        } catch {
          break;
        }
      }
      
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  /**
   * Parse sourceTexts JSON string to array.
   */
  private parseSourceTextsJson(sourceTexts: string | null | undefined): any[] {
    if (!sourceTexts) return [];
    try {
      const parsed = JSON.parse(sourceTexts);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Create a new publication.
   * If userId is provided, it checks if the user has access to the project.
   * If userId is not provided, it assumes a system call or external integration (skipped permission check).
   *
   * @param data - The publication creation data.
   * @param userId - Optional ID of the user creating the publication.
   * @returns The created publication.
   */
  public async create(data: CreatePublicationDto, userId?: string) {
    if (userId) {
      // Check if user has access to the project
      await this.permissions.checkProjectAccess(data.projectId, userId);
    }

    let translationGroupId = data.translationGroupId;

    // Handle linking to an existing publication
    if (data.linkToPublicationId) {
      // 1. Fetch target publication
      const targetPub = await this.prisma.publication.findUnique({
        where: { id: data.linkToPublicationId },
      });

      if (!targetPub) {
        throw new NotFoundException(`Target publication for linking not found`);
      }

      // 2. Validate Access (if user context provided)
      if (userId) {
        await this.permissions.checkProjectAccess(targetPub.projectId, userId);
      }

      // 3. Validate Project Scope (Issue 2)
      if (targetPub.projectId !== data.projectId) {
        throw new BadRequestException('Cannot link publications from different projects');
      }

      // 4. Validate Post Type Compatibility (User Request)
      if (data.postType && targetPub.postType !== data.postType) {
        throw new BadRequestException(`Cannot link publication of type ${data.postType} with ${targetPub.postType}`);
      }

      // Determine Group ID
      if (targetPub.translationGroupId) {
        translationGroupId = targetPub.translationGroupId;
      } else {
        // Create new group and assign to target
        translationGroupId = randomUUID();
        await this.prisma.publication.update({
          where: { id: targetPub.id },
          data: { translationGroupId },
        });
        this.logger.log(`Created new translation group ${translationGroupId} for publication ${targetPub.id}`);
      }
    }

    // 5. Validate Language Uniqueness in Group (Issue 1)
    if (translationGroupId) {
      const existingTranslation = await this.prisma.publication.findFirst({
        where: {
          translationGroupId,
          language: data.language,
          // No need to exclude current ID as we are creating
        },
      });

      if (existingTranslation) {
        throw new BadRequestException(`A publication with language ${data.language} already exists in this translation group`);
      }
    }

    const publication = await this.prisma.publication.create({
      data: {
        projectId: data.projectId,
        createdBy: userId ?? null,
        title: data.title,
        description: data.description,
        content: data.content,
        authorComment: data.authorComment,
        
        media: {
          create: [
            // New Media
            ...(data.media || []).map((m, i) => ({
              order: i,
              media: { create: { ...m, meta: JSON.stringify(m.meta || {}) } }
            })),
            // Existing Media
            ...(data.existingMediaIds || []).map((id, i) => ({
              order: (data.media?.length || 0) + i,
              media: { connect: { id } }
            })),
          ]
        },

        tags: data.tags,
        status: data.status ?? PublicationStatus.DRAFT,
        language: data.language,
        translationGroupId,
        postType: data.postType ?? PostType.POST,
        postDate: data.postDate,
        scheduledAt: data.scheduledAt,
        meta: JSON.stringify(data.meta ?? {}),
        sourceTexts: data.sourceTexts ? JSON.stringify(data.sourceTexts) : '[]',
      },
      include: this.PUBLICATION_WITH_RELATIONS_INCLUDE,
    });

    const author = userId ? `user ${userId}` : 'external system';
    this.logger.log(
      `Publication "${publication.title ?? publication.id}" created in project ${data.projectId} by ${author}`,
    );

    // Automatically create posts for specified channels
    if (data.channelIds && data.channelIds.length > 0) {
      await this.createPostsFromPublication(
        publication.id,
        data.channelIds,
        userId,
        undefined, // no scheduled time by default
      );
      this.logger.log(
        `Created ${data.channelIds.length} posts for publication ${publication.id}`,
      );
    }

    return {
      ...publication,
      meta: this.parseMetaJson(publication.meta),
      sourceTexts: this.parseSourceTextsJson(publication.sourceTexts),
    };
  }

  /**
   * Retrieve all publications for a project, optionally filtered.
   * Validates that the user has access to the project.
   *
   * @param projectId - The ID of the project.
   * @param userId - The ID of the user.
   * @param filters - Optional filters (status, limit, offset, sorting, search, etc.).
   * @returns Publications with total count for pagination.
   */
  public async findAll(
    projectId: string,
    userId: string,
    filters?: {
      status?: PublicationStatus | PublicationStatus[];
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      channelId?: string;
      search?: string;
      language?: string;
      ownership?: OwnershipType;
      socialMedia?: SocialMedia;
      issueType?: IssueType;
    },
  ) {
    await this.permissions.checkProjectAccess(projectId, userId);

    const where = this.buildWhereClause(filters || {}, userId, projectId);

    // Dynamic sorting
    const sortField = filters?.sortBy || 'chronology';
    const sortDirection = filters?.sortOrder || 'desc';
    
    // Handle special sorting modes
    let orderBy: Prisma.PublicationOrderByWithRelationInput = {};
    let customSort = false;
    
    // For chronology, byScheduled, and byPublished, we need custom sorting
    if (sortField === 'chronology' || sortField === 'byScheduled' || sortField === 'byPublished') {
      customSort = true;
      // We'll sort after fetching
      orderBy = { createdAt: 'desc' }; // Default order for fetching
    } else {
      // Standard sorting
      (orderBy as any)[sortField] = sortDirection;
    }

    const [items, total] = await Promise.all([
      this.prisma.publication.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
              telegramUsername: true,
              avatarUrl: true,
            },
          },
          posts: {
            include: {
              channel: true,
            },
          },
          media: {
            include: {
              media: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
          _count: {
            select: {
              posts: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        take: customSort ? undefined : filters?.limit,
        skip: customSort ? undefined : filters?.offset,
      }),
      this.prisma.publication.count({ where }),
    ]);

    // Apply custom sorting if needed
    let sortedItems = items;
    
    if (customSort) {
      if (sortField === 'chronology') {
        // Chronology: scheduled (latest to nearest) → published (recent to old)
        sortedItems = items.sort((a, b) => {
          const aScheduled = a.scheduledAt;
          const bScheduled = b.scheduledAt;
          
          // Get the latest publishedAt from posts
          const getLatestPublishedAt = (pub: any) => {
            const publishedDates = pub.posts
              .map((p: any) => p.publishedAt)
              .filter((d: any) => d !== null);
            if (publishedDates.length === 0) return null;
            return new Date(Math.max(...publishedDates.map((d: any) => new Date(d).getTime())));
          };
          
          const aPublishedAt = getLatestPublishedAt(a);
          const bPublishedAt = getLatestPublishedAt(b);
          
          // Both scheduled: sort by scheduledAt DESC (latest first)
          if (aScheduled && bScheduled) {
            return new Date(bScheduled).getTime() - new Date(aScheduled).getTime();
          }
          
          // Both published: sort by publishedAt DESC (recent first)
          if (aPublishedAt && bPublishedAt) {
            return bPublishedAt.getTime() - aPublishedAt.getTime();
          }
          
          // One scheduled, one published: scheduled comes first
          if (aScheduled && !bScheduled) return -1;
          if (!aScheduled && bScheduled) return 1;
          
          // Fallback to createdAt
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      } else if (sortField === 'byScheduled') {
        // Scheduled first (sorted by scheduledAt), then others (sorted by createdAt)
        sortedItems = items.sort((a, b) => {
          const aScheduled = a.scheduledAt;
          const bScheduled = b.scheduledAt;
          
          // Both have scheduledAt: sort by scheduledAt
          if (aScheduled && bScheduled) {
            const aTime = new Date(aScheduled).getTime();
            const bTime = new Date(bScheduled).getTime();
            return sortDirection === 'desc' ? bTime - aTime : aTime - bTime;
          }
          
          // One has scheduledAt, one doesn't: scheduled comes first
          if (aScheduled && !bScheduled) return -1;
          if (!aScheduled && bScheduled) return 1;
          
          // Neither has scheduledAt: sort by createdAt
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      } else if (sortField === 'byPublished') {
        // Published first (sorted by publishedAt), then others (sorted by createdAt)
        sortedItems = items.sort((a, b) => {
          const getLatestPublishedAt = (pub: any) => {
            const publishedDates = pub.posts
              .map((p: any) => p.publishedAt)
              .filter((d: any) => d !== null);
            if (publishedDates.length === 0) return null;
            return new Date(Math.max(...publishedDates.map((d: any) => new Date(d).getTime())));
          };
          
          const aPublishedAt = getLatestPublishedAt(a);
          const bPublishedAt = getLatestPublishedAt(b);
          
          // Both have publishedAt: sort by publishedAt
          if (aPublishedAt && bPublishedAt) {
            return sortDirection === 'desc' ? bPublishedAt.getTime() - aPublishedAt.getTime() : aPublishedAt.getTime() - bPublishedAt.getTime();
          }
          
          // One has publishedAt, one doesn't: published comes first
          if (aPublishedAt && !bPublishedAt) return -1;
          if (!aPublishedAt && bPublishedAt) return 1;
          
          // Neither has publishedAt: sort by createdAt
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }
      
      // Apply pagination after custom sorting
      const offset = filters?.offset || 0;
      const limit = filters?.limit || sortedItems.length;
      sortedItems = sortedItems.slice(offset, offset + limit);
    }

    return {
      items: sortedItems.map((item: any) => ({
        ...item,
        meta: this.parseMetaJson(item.meta),
        sourceTexts: this.parseSourceTextsJson(item.sourceTexts),
      })),
      total,
    };
  }

  /**
   * Retrieve all publications for a given user across all projects they are members of.
   *
   * @param userId - The ID of the user requesting the publications.
   * @param filters - Optional filters (status, limit, offset, includeArchived, sorting, search, etc.).
   * @returns Publications with total count for pagination.
   */
  /**
   * Retrieve all publications for a given user across all projects they are members of.
   *
   * @param userId - The ID of the user requesting the publications.
   * @param filters - Optional filters.
   * @returns Publications with total count for pagination.
   */
  public async findAllForUser(
    userId: string,
    filters?: {
      status?: PublicationStatus | PublicationStatus[];
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      channelId?: string;
      search?: string;
      language?: string;
      ownership?: OwnershipType;
      socialMedia?: SocialMedia;
      issueType?: IssueType;
    },
  ) {
    this.logger.log(`findAllForUser called for user ${userId} with search: "${filters?.search || ''}"`);
    // 1. Get all projects where user is a member
    const userProjects = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const userProjectIds = userProjects.map(p => p.projectId);

    if (userProjectIds.length === 0) {
      return { items: [], total: 0 };
    }

    // 2. Build filter with explicit projectId list
    const where = this.buildWhereClause(filters || {}, userId);
    
    // Override the project relation filter from buildWhereClause with explicit IN clause
    // buildWhereClause adds 'project: { members... }'. We want to replace/simplify that.
    // Actually, buildWhereClause is private. Let's look at it.
    // It adds: where.project = { members: { some: { userId } }, archivedAt: null }
    // We want to remove that and strictly use projectId IN list.
    // But buildWhereClause assumes it's handling the security check.
    
    // Let's modify buildWhereClause usage or manually construct where here to be safe.
    // Since we can't easily change buildWhereClause without affecting findAll, 
    // we can just OVERWRITE where.project and where.projectId.
    
    // Re-construct basic where without buildWhereClause for clarity and safety in this new approach?
    // Or just patch the result of buildWhereClause.
    
    // buildWhereClause logic:
    /*
      where.project = {
        members: { some: { userId } },
        archivedAt: null,
      };
      if (!filters?.includeArchived) {
        where.archivedAt = null;
      }
    */
    
    // We want:
    // where.projectId = { in: userProjectIds }
    // where.project = { archivedAt: null } (if needed) or just trust userProjectIds are mostly valid? 
    // userProjectIds includes archived projects?
    // projectMember exists for archived projects? Yes.
    // So we still need to filter out archived projects if !includeArchived.
    
    // So:
    delete where.project; // Remove the complex member check
    
    where.projectId = { in: userProjectIds };
    
    if (!filters?.includeArchived) {
        where.project = { archivedAt: null }; // Only check for archived status
        where.archivedAt = null;
    }
    
    // The rest of buildWhereClause logic (status, channelId, etc.) is fine and preserved in 'where'
    // BUT buildWhereClause was called with userId.
    // It logic:
    /*
     } else {
      where.project = {
        members: {
          some: { userId },
        },
        archivedAt: null,
      };
      if (!filters?.includeArchived) {
        where.archivedAt = null;
      }
    }
    */
    
    // So if we delete where.project, we lose 'archivedAt: null' inside it.
    // So we must restore it.
     
    // Dynamic sorting
    const sortField = filters?.sortBy || 'chronology';
    const sortDirection = filters?.sortOrder || 'desc';
    
    // Handle special sorting modes
    let orderBy: Prisma.PublicationOrderByWithRelationInput = {};
    let customSort = false;
    
    // For chronology, byScheduled, and byPublished, we need custom sorting
    if (sortField === 'chronology' || sortField === 'byScheduled' || sortField === 'byPublished') {
      customSort = true;
      // We'll sort after fetching
      orderBy = { createdAt: 'desc' }; // Default order for fetching
    } else {
      // Standard sorting
      (orderBy as any)[sortField] = sortDirection;
    }

    const [items, total] = await Promise.all([
      this.prisma.publication.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
              telegramUsername: true,
              avatarUrl: true,
            },
          },
          posts: {
            include: {
              channel: true,
            },
          },
          media: {
            include: {
              media: true,
            },
            orderBy: {
              order: 'asc',
            },
          },
          _count: {
            select: {
              posts: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        take: customSort ? undefined : filters?.limit,
        skip: customSort ? undefined : filters?.offset,
      }),
      this.prisma.publication.count({ where }),
    ]);

    // Apply custom sorting if needed
    let sortedItems = items;
    
    if (customSort) {
      if (sortField === 'chronology') {
        // Chronology: scheduled (latest to nearest) → published (recent to old)
        sortedItems = items.sort((a, b) => {
          const aScheduled = a.scheduledAt;
          const bScheduled = b.scheduledAt;
          const aPublished = a.posts.some(p => p.publishedAt);
          const bPublished = b.posts.some(p => p.publishedAt);
          
          // Get the latest publishedAt from posts
          const getLatestPublishedAt = (pub: any) => {
            const publishedDates = pub.posts
              .map((p: any) => p.publishedAt)
              .filter((d: any) => d !== null);
            if (publishedDates.length === 0) return null;
            return new Date(Math.max(...publishedDates.map((d: any) => new Date(d).getTime())));
          };
          
          const aPublishedAt = getLatestPublishedAt(a);
          const bPublishedAt = getLatestPublishedAt(b);
          
          // Both scheduled: sort by scheduledAt DESC (latest first)
          if (aScheduled && bScheduled) {
            return new Date(bScheduled).getTime() - new Date(aScheduled).getTime();
          }
          
          // Both published: sort by publishedAt DESC (recent first)
          if (aPublishedAt && bPublishedAt) {
            return bPublishedAt.getTime() - aPublishedAt.getTime();
          }
          
          // One scheduled, one published: scheduled comes first
          if (aScheduled && !bScheduled) return -1;
          if (!aScheduled && bScheduled) return 1;
          
          // Fallback to createdAt
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      } else if (sortField === 'byScheduled') {
        // Scheduled first (sorted by scheduledAt), then others (sorted by createdAt)
        sortedItems = items.sort((a, b) => {
          const aScheduled = a.scheduledAt;
          const bScheduled = b.scheduledAt;
          
          // Both have scheduledAt: sort by scheduledAt
          if (aScheduled && bScheduled) {
            const aTime = new Date(aScheduled).getTime();
            const bTime = new Date(bScheduled).getTime();
            return sortDirection === 'desc' ? bTime - aTime : aTime - bTime;
          }
          
          // One has scheduledAt, one doesn't: scheduled comes first
          if (aScheduled && !bScheduled) return -1;
          if (!aScheduled && bScheduled) return 1;
          
          // Neither has scheduledAt: sort by createdAt
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      } else if (sortField === 'byPublished') {
        // Published first (sorted by publishedAt), then others (sorted by createdAt)
        sortedItems = items.sort((a, b) => {
          const getLatestPublishedAt = (pub: any) => {
            const publishedDates = pub.posts
              .map((p: any) => p.publishedAt)
              .filter((d: any) => d !== null);
            if (publishedDates.length === 0) return null;
            return new Date(Math.max(...publishedDates.map((d: any) => new Date(d).getTime())));
          };
          
          const aPublishedAt = getLatestPublishedAt(a);
          const bPublishedAt = getLatestPublishedAt(b);
          
          // Both have publishedAt: sort by publishedAt
          if (aPublishedAt && bPublishedAt) {
            return sortDirection === 'desc' ? bPublishedAt.getTime() - aPublishedAt.getTime() : aPublishedAt.getTime() - bPublishedAt.getTime();
          }
          
          // One has publishedAt, one doesn't: published comes first
          if (aPublishedAt && !bPublishedAt) return -1;
          if (!aPublishedAt && bPublishedAt) return 1;
          
          // Neither has publishedAt: sort by createdAt
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }
      
      // Apply pagination after custom sorting
      const offset = filters?.offset || 0;
      const limit = filters?.limit || sortedItems.length;
      sortedItems = sortedItems.slice(offset, offset + limit);
    }

    return {
      items: sortedItems.map((item: any) => ({
        ...item,
        meta: this.parseMetaJson(item.meta),
        sourceTexts: this.parseSourceTextsJson(item.sourceTexts),
      })),
      total,
    };
  }

  /**
   * Find a single publication by ID.
   * Ensures the user has access to the project containing the publication.
   *
   * @param id - The ID of the publication.
   * @param userId - The ID of the user.
   * @returns The publication details.
   * @throws NotFoundException if the publication does not exist.
   */
  public async findOne(id: string, userId: string) {
    const publication = await this.prisma.publication.findUnique({
      where: {
        id,
      },
      include: this.PUBLICATION_WITH_RELATIONS_INCLUDE,
    });

    if (!publication) {
      throw new NotFoundException('Publication not found');
    }

    await this.permissions.checkProjectAccess(publication.projectId, userId);

    // Fetch other publications in the same translation group
    let translations: any[] = [];
    if (publication.translationGroupId) {
      translations = await this.prisma.publication.findMany({
        where: {
          translationGroupId: publication.translationGroupId,
          id: { not: id },
          archivedAt: null,
        },
        select: {
          id: true,
          language: true,
          postType: true,
          title: true,
        },
        orderBy: {
          language: 'asc',
        },
      });
    }

    // Parse meta JSON for media items
    const parsedMedia = publication.media?.map(pm => ({
      ...pm,
      media: pm.media ? {
        ...pm.media,
        meta: this.parseMetaJson(pm.media.meta),
      } : pm.media,
    }));

    return {
      ...publication,
      media: parsedMedia,
      translations,
      meta: this.parseMetaJson(publication.meta),
      sourceTexts: this.parseSourceTextsJson((publication as any).sourceTexts),
    };
  }

  /**
   * Update an existing publication.
   * Allowed for the author or project OWNER/ADMIN.
   *
   * @param id - The ID of the publication.
   * @param userId - The ID of the user.
   * @param data - The data to update.
   */
  public async update(id: string, userId: string, data: UpdatePublicationDto) {
    const publication = await this.findOne(id, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      await this.permissions.checkProjectPermission(publication.projectId, userId, [
        ProjectRole.OWNER,
        ProjectRole.ADMIN,
      ]);
    }

    let translationGroupId = data.translationGroupId;

    // Handle Unlinking: if explicit null is passed, we accept it.
    // If undefined, we keep current (handled by 'const translationGroupId = data.translationGroupId' -> undefined)
    // BUT we must check if user wants to change logic.
    // Prisma update: undefined means "do nothing", null means "set to NULL".
    
    if (data.linkToPublicationId) {
      // 1. Self-linking check (Issue 9)
      if (data.linkToPublicationId === id) {
         throw new BadRequestException('Cannot link publication to itself');
      }

      // 2. Fetch target
      const targetPub = await this.prisma.publication.findUnique({
        where: { id: data.linkToPublicationId },
      });

      if (!targetPub) {
        throw new NotFoundException(`Target publication for linking not found`);
      }

      // 3. Access Check
      if (publication.createdBy !== userId) { // Use original permission context or check again
         await this.permissions.checkProjectAccess(targetPub.projectId, userId);
      }

      // 4. Project Scope
      if (targetPub.projectId !== publication.projectId) { // Assuming project doesn't change on update
         throw new BadRequestException('Cannot link publications from different projects');
      }

      // 5. Post Type Compatibility
      const newPostType = data.postType || publication.postType;
      if (targetPub.postType !== newPostType) {
         throw new BadRequestException(`Cannot link publication of type ${newPostType} with ${targetPub.postType}`);
      }

      if (targetPub.translationGroupId) {
        translationGroupId = targetPub.translationGroupId;
      } else {
        translationGroupId = randomUUID();
        await this.prisma.publication.update({
          where: { id: targetPub.id },
          data: { translationGroupId },
        });
        this.logger.log(`Created new translation group ${translationGroupId} for publication ${targetPub.id}`);
      }
    }

    // 6. Validate Language Uniqueness in Group (Issue 1)
    // Only check if we are setting a NEW group ID or changing language
    // If translationGroupId is undefined, we use current publication's group (if we are checking language change)
    // Actually, if we update language OR update group, we must check.
    
    const effectiveGroupId = translationGroupId !== undefined ? translationGroupId : publication.translationGroupId;
    const effectiveLanguage = data.language || publication.language;

    if (effectiveGroupId) {
       const existingTranslation = await this.prisma.publication.findFirst({
        where: {
          translationGroupId: effectiveGroupId,
          language: effectiveLanguage,
          id: { not: id }, // Exclude self
        },
      });

      if (existingTranslation) {
        throw new BadRequestException(`A publication with language ${effectiveLanguage} already exists in this translation group`);
      }
    }

    // Business Rule: When status changes to DRAFT or READY
    if (data.status === PublicationStatus.DRAFT || data.status === PublicationStatus.READY) {
      // Validate content is filled for READY status
      if (data.status === PublicationStatus.READY) {
        const contentToCheck = data.content !== undefined ? data.content : publication.content;
        
        // Check for media presence (either in update data or existing)
        const isMediaUpdating = data.media !== undefined || data.existingMediaIds !== undefined;
        const newMediaCount = (data.media?.length || 0) + (data.existingMediaIds?.length || 0);
        const hasMedia = isMediaUpdating ? newMediaCount > 0 : (publication.media && publication.media.length > 0);

        if (!contentToCheck && !hasMedia) {
          throw new BadRequestException('Content or Media is required when status is READY');
        }
      }

      // Reset scheduledAt
      data.scheduledAt = null;

      // Reset all posts to PENDING
      await this.prisma.post.updateMany({
        where: { publicationId: id },
        data: {
          status: PostStatus.PENDING,
          scheduledAt: null,
          errorMessage: null,
        },
      });
    }

    // Business Rule: When scheduledAt is set
    if (data.scheduledAt !== undefined && data.scheduledAt !== null) {
      // Validate content is filled
      const contentToCheck = data.content !== undefined ? data.content : publication.content;
      
      // Check for media presence (either in update data or existing)
      const isMediaUpdating = data.media !== undefined || data.existingMediaIds !== undefined;
      const newMediaCount = (data.media?.length || 0) + (data.existingMediaIds?.length || 0);
      const hasMedia = isMediaUpdating ? newMediaCount > 0 : (publication.media && publication.media.length > 0);

      if (!contentToCheck && !hasMedia) {
        throw new BadRequestException('Content or Media is required when setting scheduledAt');
      }

      // Automatically set status to SCHEDULED
      data.status = PublicationStatus.SCHEDULED;

      // Reset posts without their own scheduledAt
      await this.prisma.post.updateMany({
        where: {
          publicationId: id,
          scheduledAt: null,
        },
        data: {
          status: PostStatus.PENDING,
          errorMessage: null,
        },
      });
    }

    const updated = await this.prisma.publication.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        authorComment: data.authorComment,
        // Update Media: Replace all existing with new list if any media field is provided
        // Logic: if any media DTO field is present, we assume full replace.
        // If all are undefined, we touch nothing.
        // Note: This logic assumes that the client sends the FULL state of media.
        media: (data.media || data.existingMediaIds) ? {
          deleteMany: {}, // Clear existing
          create: [
             // New Media
             ...(data.media || []).map((m, i) => ({
              order: i,
              media: { create: { ...m, meta: JSON.stringify(m.meta || {}) } }
            })),
            // Existing Media
            ...(data.existingMediaIds || []).map((id, i) => ({
              order: (data.media?.length || 0) + i,
              media: { connect: { id } }
            })),
          ]
        } : undefined,
        tags: data.tags,
        status: data.status,
        language: data.language,
        translationGroupId,
        postType: data.postType,
        postDate: data.postDate,
        scheduledAt: data.scheduledAt,
        meta: data.meta ? JSON.stringify(data.meta) : undefined,
        sourceTexts: data.sourceTexts !== undefined ? JSON.stringify(data.sourceTexts) : undefined,
      },
      include: this.PUBLICATION_WITH_RELATIONS_INCLUDE,
    });

    return {
      ...updated,
      meta: this.parseMetaJson(updated.meta),
      sourceTexts: this.parseSourceTextsJson(updated.sourceTexts),
    };
  }

  /**
   * Delete a publication.
   * Allowed for the author or project OWNER/ADMIN.
   *
   * @param id - The ID of the publication to remove.
   * @param userId - The ID of the user.
   */
  public async remove(id: string, userId: string) {
    const publication = await this.findOne(id, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      await this.permissions.checkProjectPermission(publication.projectId, userId, [
        ProjectRole.OWNER,
        ProjectRole.ADMIN,
      ]);
    }

    return this.prisma.publication.delete({
      where: { id },
    });
  }

  /**
   * Generate individual posts for specified channels from a publication.
   * Posts inherit content from the publication automatically.
   * Verifies that all channels belong to the same project as the publication.
   *
   * @param publicationId - The ID of the source publication.
   * @param channelIds - List of channel IDs to create posts for.
   * @param userId - Optional user ID (if authenticated request).
   * @param scheduledAt - Optional schedule time for the posts.
   * @returns The created posts.
   */
  public async createPostsFromPublication(
    publicationId: string,
    channelIds: string[],
    userId?: string,
    scheduledAt?: Date,
  ) {
    // Validate channelIds is not empty
    if (!channelIds || channelIds.length === 0) {
      throw new BadRequestException('At least one channel must be specified');
    }

    let publication;

    if (userId) {
      publication = await this.findOne(publicationId, userId);
    } else {
      // System/External fetch
      publication = await this.prisma.publication.findUnique({
        where: { id: publicationId },
      });
      if (!publication) {
        throw new NotFoundException('Publication not found');
      }
    }

    // Verify all channels belong to the same project
    const channels = await this.prisma.channel.findMany({
      where: {
        id: { in: channelIds },
        projectId: publication.projectId,
      },
    });

    if (channels.length !== channelIds.length) {
      throw new NotFoundException('Some channels not found or do not belong to this project');
    }

    // Create posts for each channel (content comes from publication via relation)
    const posts = await Promise.all(
      channels.map(channel =>
        this.prisma.post.create({
          data: {
            publicationId: publication.id,
            channelId: channel.id,
            socialMedia: channel.socialMedia,
            tags: null, // Can be overridden later, defaults to publication tags
            status: PostStatus.PENDING,
            scheduledAt: scheduledAt ?? publication.scheduledAt,
          },
          include: {
            channel: true,
            publication: true, // Include full publication with content
          },
        }),
      ),
    );

    return posts;
  }

  /**
   * Add media files to an existing publication.
   * Appends new media to the end of the existing media list.
   *
   * @param publicationId - The ID of the publication.
   * @param userId - The ID of the user.
   * @param media - Array of media items to add.
   * @returns The updated publication.
   */
  public async addMedia(publicationId: string, userId: string, media: any[]) {
    const publication = await this.findOne(publicationId, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      await this.permissions.checkProjectPermission(publication.projectId, userId, [
        ProjectRole.OWNER,
        ProjectRole.ADMIN,
      ]);
    }

    // Get the current max order
    const existingMedia = await this.prisma.publicationMedia.findMany({
      where: { publicationId },
      orderBy: { order: 'desc' },
      take: 1,
    });

    const startOrder = existingMedia.length > 0 ? existingMedia[0].order + 1 : 0;

    // Use transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < media.length; i++) {
        const m = media[i];
        const mediaItem = await tx.media.create({
          data: {
            type: m.type,
            storageType: m.storageType,
            storagePath: m.storagePath,
            filename: m.filename,
            mimeType: m.mimeType,
            sizeBytes: m.sizeBytes,
            meta: JSON.stringify(m.meta || {}),
          },
        });

        await tx.publicationMedia.create({
          data: {
            publicationId,
            mediaId: mediaItem.id,
            order: startOrder + i,
          },
        });
      }
    });

    this.logger.log(`Added ${media.length} media items to publication ${publicationId}`);
    return this.findOne(publicationId, userId);
  }

  /**
   * Remove a media file from a publication.
   *
   * @param publicationId - The ID of the publication.
   * @param userId - The ID of the user.
   * @param mediaId - The ID of the media to remove.
   * @returns Success status.
   */
  public async removeMedia(publicationId: string, userId: string, mediaId: string) {
    const publication = await this.findOne(publicationId, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      await this.permissions.checkProjectPermission(publication.projectId, userId, [
        ProjectRole.OWNER,
        ProjectRole.ADMIN,
      ]);
    }

    // Find the publication media entry
    const pubMedia = await this.prisma.publicationMedia.findFirst({
      where: {
        publicationId,
        mediaId,
      },
    });

    if (!pubMedia) {
      throw new NotFoundException('Media not found in this publication');
    }

    // Delete the publication media link
    await this.prisma.publicationMedia.delete({
      where: { id: pubMedia.id },
    });

    return { success: true };
  }

  /**
   * Reorder media files in a publication.
   *
   * @param publicationId - The ID of the publication.
   * @param userId - The ID of the user.
   * @param mediaOrder - Array of media IDs with their new order.
   * @returns Success status.
   */
  public async reorderMedia(publicationId: string, userId: string, mediaOrder: Array<{ id: string; order: number }>) {
    const publication = await this.findOne(publicationId, userId);

    // Check if user is author or has admin rights
    if (publication.createdBy !== userId) {
      await this.permissions.checkProjectPermission(publication.projectId, userId, [
        ProjectRole.OWNER,
        ProjectRole.ADMIN,
      ]);
    }

    // Update order for each media item in a transaction
    await this.prisma.$transaction(
      mediaOrder.map(({ id, order }) =>
        this.prisma.publicationMedia.updateMany({
          where: {
            publicationId,
            id,
          },
          data: {
            order,
          },
        })
      )
    );

    this.logger.log(`Reordered ${mediaOrder.length} media items in publication ${publicationId}`);
    return { success: true };
  }
}

