import { PublicationStatus, PostType, Prisma, SocialMedia } from '../../generated/prisma/client.js';
import { IssueType, OwnershipType } from './dto/index.js';

/**
 * Helper class to build Prisma WHERE clauses for Publications.
 * Enhances SOLID by separating query construction logic from the main service.
 */
export class PublicationQueryBuilder {
  /**
   * Build WHERE clause for publication queries with filters.
   */
  public static buildWhere(
    userId: string,
    projectId?: string,
    filters?: {
      status?: PublicationStatus | PublicationStatus[];
      includeArchived?: boolean;
      channelId?: string;
      socialMedia?: SocialMedia;
      ownership?: OwnershipType;
      issueType?: IssueType;
      search?: string;
      language?: string;
      publishedAfter?: Date;
    },
    userAllowedProjectIds?: string[],
  ): Prisma.PublicationWhereInput {
    const where: Prisma.PublicationWhereInput = {};
    const conditions: Prisma.PublicationWhereInput[] = [];

    // Project filter & Scoping
    if (projectId) {
      where.projectId = projectId;
    } else if (userAllowedProjectIds) {
      where.projectId = { in: userAllowedProjectIds };
    } else {
      where.project = {
        members: {
          some: { userId },
        },
      };
    }

    // Archive filter
    if (!filters?.includeArchived) {
      where.archivedAt = null;
      if (where.project) {
        (where.project as any).archivedAt = null;
      } else {
        where.project = { archivedAt: null };
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
            { posts: { some: { status: PostStatus.FAILED } } },
          ],
        });
      } else if (filters.issueType === IssueType.PARTIAL) {
        where.status = PublicationStatus.PARTIAL;
      } else if (filters.issueType === IssueType.EXPIRED) {
        where.status = PublicationStatus.EXPIRED;
      }
    }

    // Text search
    if (filters?.search) {
      conditions.push({
        OR: [
          { title: { contains: filters.search } },
          { description: { contains: filters.search } },
          { content: { contains: filters.search } },
        ],
      });
    }

    // Filter by language
    if (filters?.language) {
      where.language = filters.language;
    }

    // Filter by publication date (last 24h for example)
    if (filters?.publishedAfter) {
      conditions.push({
        posts: {
          some: {
            publishedAt: { gte: filters.publishedAfter },
            status: PostStatus.PUBLISHED,
          },
        },
      });
    }

    // Apply AND conditions
    if (conditions.length > 0) {
      where.AND = conditions;
    }

    return where;
  }

  /**
   * Determine the primary ORDER BY clause for Prisma.
   */
  public static getOrderBy(
    sortField: string,
    sortDirection: 'asc' | 'desc',
  ): Prisma.PublicationOrderByWithRelationInput[] {
    if (sortField === 'chronology') {
      // Best approximation for DB-level chronology sort without denormalization
      return [
        { scheduledAt: 'desc' },
        { createdAt: 'desc' },
      ];
    }

    if (sortField === 'byScheduled') {
      return [
        { scheduledAt: sortDirection },
        { createdAt: 'desc' },
      ];
    }

    if (sortField === 'byPublished') {
      // We can't sort by aggregate of related posts easily in Prisma
      // Fallback to createdAt or use separate field
      return [{ createdAt: sortDirection }];
    }

    // Default standard fields
    const orderBy: any = {};
    orderBy[sortField] = sortDirection;
    return [orderBy];
  }
}

// Re-export required types if needed
enum PostStatus {
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  PUBLISHED = 'PUBLISHED',
}
