import { Prisma } from '../../../generated/prisma/index.js';
import { ChannelIssuesPattern } from './channel-issues.util.js';

export class ChannelFiltersUtil {
  public static buildWhereClause(
    filters: any,
    user: { isAdmin: boolean },
    userAllowedProjectIds: string[],
    userId: string,
  ): Prisma.ChannelWhereInput {
    const where: any = {};
    if (filters.archivedOnly) {
      where.OR = [{ archivedAt: { not: null } }, { project: { archivedAt: { not: null } } }];
    } else if (!filters.includeArchived) {
      where.archivedAt = null;
      where.project = { archivedAt: null };
    }

    if (!user?.isAdmin) {
      if (userAllowedProjectIds.length === 0) return { id: { in: [] } };

      if (filters.projectIds && filters.projectIds.length > 0) {
        const allowedIds = filters.projectIds.filter((id: string) => userAllowedProjectIds.includes(id));
        if (allowedIds.length === 0) return { id: { in: [] } };
        where.projectId = { in: allowedIds };
      } else {
        where.projectId = { in: userAllowedProjectIds };
      }
    } else {
      if (filters.projectIds && filters.projectIds.length > 0) {
        where.projectId = { in: filters.projectIds };
      }

      if (filters.ownership) {
        if (filters.ownership === 'own') {
          where.project = { ...where.project, ownerId: userId };
        } else if (filters.ownership === 'guest') {
          where.project = {
            ...where.project,
            ownerId: { not: userId },
            members: { some: { userId } },
          };
        }
      }
    }

    const andConditions: any[] = [];
    if (filters.search) {
      andConditions.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { channelIdentifier: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.socialMedia) where.socialMedia = filters.socialMedia;
    if (filters.language) where.language = filters.language;

    if (filters.issueType) {
      if (filters.issueType === 'inactive') {
        andConditions.push(ChannelIssuesPattern.getInactiveCondition());
      } else if (filters.issueType === 'noCredentials') {
        andConditions.push(ChannelIssuesPattern.getNoCredentialsCondition());
      } else if (filters.issueType === 'failedPosts') {
        andConditions.push(ChannelIssuesPattern.getFailedPostsCondition());
      } else if (filters.issueType === 'stale') {
        andConditions.push(ChannelIssuesPattern.getStaleCondition());
      } else if (filters.issueType === 'problematic') {
        andConditions.push(ChannelIssuesPattern.getProblematicCondition());
      }
    }

    if (andConditions.length > 0) where.AND = andConditions;
    return where;
  }

  public static buildOrderBy(filters: any): Prisma.ChannelOrderByWithRelationInput[] {
    const orderBy: any[] = [];
    const sortField = filters.sortBy ?? 'alphabetical';
    const sortOrder = filters.sortOrder ?? 'asc';
    
    if (sortField === 'alphabetical') {
      orderBy.push({ name: sortOrder }, { id: 'asc' });
    } else if (sortField === 'socialMedia') {
      orderBy.push({ socialMedia: sortOrder }, { name: 'asc' }, { id: 'asc' });
    } else if (sortField === 'language') {
      orderBy.push({ language: sortOrder }, { name: 'asc' }, { id: 'asc' });
    } else if (sortField === 'postsCount') {
      orderBy.push({ posts: { _count: sortOrder } }, { name: 'asc' }, { id: 'asc' });
    } else {
      orderBy.push({ name: sortOrder }, { id: 'asc' });
    }
    
    return orderBy;
  }

  public static buildUnfilteredWhere(filters: any, baseWhere: any, user: { isAdmin: boolean }): Prisma.ChannelWhereInput {
    const unfilteredWhere: any = { archivedAt: null, project: { archivedAt: null } };
    if (!user?.isAdmin) {
      unfilteredWhere.projectId = baseWhere.projectId;
      if (filters.ownership) {
        unfilteredWhere.project = { ...unfilteredWhere.project, ...baseWhere.project };
      }
    }
    return unfilteredWhere;
  }
}
