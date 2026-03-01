import { PrismaService } from '../../prisma/prisma.service.js';
import { PublicationStatus, PostStatus, Prisma } from '../../../generated/prisma/index.js';
import { DEFAULT_STALE_CHANNELS_DAYS } from '../../../common/constants/global.constants.js';
import { ChannelIssuesPattern } from '../../channels/utils/channel-issues.util.js';

export class ProjectStatsUtil {
  public static async getStatsForProjects(prisma: PrismaService, projectIds: string[]) {
    if (projectIds.length === 0) return new Map();

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres');

    const [
      problematicCounts,
      failedPostsRaw,
      staleChannelsRaw,
      noCredentialsRaw,
      inactiveRaw,
      projectLanguages,
    ] = await Promise.all([
      prisma.publication.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          status: {
            in: [PublicationStatus.FAILED, PublicationStatus.PARTIAL, PublicationStatus.EXPIRED],
          },
          archivedAt: null,
        },
        _count: { id: true },
      }),
      prisma.post.groupBy({
        by: ['channelId'],
        where: {
          status: PostStatus.FAILED,
          channel: { projectId: { in: projectIds } },
          publication: { archivedAt: null },
        },
        _count: { id: true },
      }),
      isPostgres
        ? prisma.$queryRaw<Array<{ projectId: string; count: bigint }>>`
            SELECT c.project_id as "projectId", COUNT(c.id) as "count" 
            FROM channels c 
            JOIN projects p ON c.project_id = p.id
            JOIN (
                SELECT channel_id, MAX(published_at) as last_published_at
                FROM posts
                WHERE published_at IS NOT NULL
                GROUP BY channel_id
            ) lp ON c.id = lp.channel_id
            WHERE c.project_id IN (${Prisma.join(projectIds)}) AND c.archived_at IS NULL
              AND lp.last_published_at < NOW() - (COALESCE((c.preferences->>'staleChannelsDays')::integer, (p.preferences->>'staleChannelsDays')::integer, ${DEFAULT_STALE_CHANNELS_DAYS}) || ' days')::interval
            GROUP BY c.project_id`
        : prisma.$queryRaw<Array<{ projectId: string; count: bigint }>>`
            SELECT c.project_id as projectId, COUNT(c.id) as count 
            FROM channels c 
            JOIN projects p ON c.project_id = p.id
            JOIN (
                SELECT channel_id, MAX(published_at) as last_published_at
                FROM posts
                WHERE published_at IS NOT NULL
                GROUP BY channel_id
            ) lp ON c.id = lp.channel_id
            WHERE c.project_id IN (${Prisma.join(projectIds)}) AND c.archived_at IS NULL
              AND lp.last_published_at < DATETIME('now', '-' || CAST(COALESCE(json_extract(c.preferences, '$.staleChannelsDays'), json_extract(p.preferences, '$.staleChannelsDays'), ${DEFAULT_STALE_CHANNELS_DAYS}) AS TEXT) || ' days')
            GROUP BY c.project_id`,
      prisma.channel.findMany({
        where: {
          projectId: { in: projectIds },
          archivedAt: null,
        },
        select: { id: true, projectId: true, credentials: true, socialMedia: true },
      }),
      prisma.channel.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, archivedAt: null, isActive: false },
        _count: { id: true },
      }),
      prisma.channel.findMany({
        where: { projectId: { in: projectIds }, archivedAt: null },
        select: { id: true, projectId: true, language: true },
      }),
    ]);

    const problematicCountMap = Object.fromEntries(
      problematicCounts.map(c => [c.projectId, c._count.id]),
    );

    const channelProjectMap = new Map<string, string>();
    const languageMap = new Map<string, string[]>();

    projectLanguages.forEach(l => {
      channelProjectMap.set(l.id, l.projectId);
      if (!languageMap.has(l.projectId)) languageMap.set(l.projectId, []);
      const langs = languageMap.get(l.projectId)!;
      if (!langs.includes(l.language)) langs.push(l.language);
    });

    const failedPostsMap = new Map<string, number>();
    failedPostsRaw.forEach((row: any) => {
      const projectId = channelProjectMap.get(row.channelId);
      if (projectId) {
        failedPostsMap.set(
          projectId,
          (failedPostsMap.get(projectId) || 0) + Number(row._count.id || 0),
        );
      }
    });

    const staleChannelsMap = new Map<string, number>();
    staleChannelsRaw.forEach((row: any) =>
      staleChannelsMap.set(row.projectId, Number(row.count || 0)),
    );

    const noCredentialsMap = new Map<string, number>();
    noCredentialsRaw.forEach((row: any) => {
      if (!ChannelIssuesPattern.hasAccurateCredentialsLogic(row.credentials, row.socialMedia)) {
        noCredentialsMap.set(row.projectId, (noCredentialsMap.get(row.projectId) || 0) + 1);
      }
    });

    const inactiveMap = new Map<string, number>();
    inactiveRaw.forEach((row: any) => inactiveMap.set(row.projectId, Number(row._count.id || 0)));

    const result = new Map<string, any>();
    for (const projectId of projectIds) {
      result.set(projectId, {
        languages: (languageMap.get(projectId) || []).sort(),
        failedPostsCount: failedPostsMap.get(projectId) || 0,
        problemPublicationsCount: problematicCountMap[projectId] || 0,
        noCredentialsChannelsCount: noCredentialsMap.get(projectId) || 0,
        inactiveChannelsCount: inactiveMap.get(projectId) || 0,
        staleChannelsCount: staleChannelsMap.get(projectId) || 0,
      });
    }

    return result;
  }

  public static async getPublicationsSummary(prisma: PrismaService, projectId: string) {
    const counts = await prisma.publication.groupBy({
      by: ['status'],
      where: { projectId, archivedAt: null },
      _count: { id: true },
    });

    const summary = {
      DRAFT: 0,
      READY: 0,
      SCHEDULED: 0,
      PUBLISHED: 0,
      ISSUES: 0,
    };

    counts.forEach((c: any) => {
      const status = c.status;
      if (status === PublicationStatus.DRAFT) summary.DRAFT = c._count.id;
      else if (status === PublicationStatus.READY) summary.READY = c._count.id;
      else if (status === PublicationStatus.SCHEDULED) summary.SCHEDULED = c._count.id;
      else if (status === PublicationStatus.PUBLISHED) summary.PUBLISHED = c._count.id;
      else if (
        [PublicationStatus.PARTIAL, PublicationStatus.FAILED, PublicationStatus.EXPIRED].includes(
          status as any,
        )
      ) {
        summary.ISSUES += c._count.id;
      }
    });

    return summary;
  }
}
