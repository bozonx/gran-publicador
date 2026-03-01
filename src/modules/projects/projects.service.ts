import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsConfig } from '../../config/news.config.js';
import { HttpConfig } from '../../config/http.config.js';
import {
  Prisma,
  type Project,
  PublicationStatus,
  PostStatus,
} from '../../generated/prisma/index.js';

import { TRANSACTION_TIMEOUT } from '../../common/constants/database.constants.js';
import { DEFAULT_STALE_CHANNELS_DAYS } from '../../common/constants/global.constants.js';
import {
  requestJsonWithRetry,
  requestTextWithRetry,
} from '../../common/utils/http-request-with-retry.util.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CreateProjectDto,
  UpdateProjectDto,
  AddMemberDto,
  UpdateMemberDto,
  SearchNewsQueryDto,
  FetchNewsContentDto,
  TransferProjectDto,
} from './dto/index.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RolesService } from '../roles/roles.service.js';
import { PermissionKey } from '../../common/types/permissions.types.js';
import { I18nService } from 'nestjs-i18n';
import { getPlatformConfig } from '@gran/shared/social-media-platforms';
import { BaseCrudService } from '../../common/services/base-crud.service.js';
import { ChannelIssuesPattern } from '../channels/utils/channel-issues.util.js';
import { ProjectStatsUtil } from './utils/project-stats.util.js';

@Injectable()
export class ProjectsService extends BaseCrudService<Project | any> {
  protected get modelDelegate() {
    return this.prisma.project as any;
  }

  private readonly logger = new Logger(ProjectsService.name);
  private readonly httpConfig: HttpConfig;

  constructor(
    private prisma: PrismaService,
    private permissions: PermissionsService,
    private notifications: NotificationsService,
    private roles: RolesService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    super();
    this.httpConfig = this.configService.get<HttpConfig>('http')!;
  }

  private get retryConfig() {
    return {
      maxAttempts: this.httpConfig.retryMaxAttempts,
      initialDelayMs: this.httpConfig.retryInitialDelayMs,
      maxDelayMs: this.httpConfig.retryMaxDelayMs,
    };
  }



  public async create(userId: string, data: CreateProjectDto): Promise<Project> {
    return this.prisma.$transaction(
      async tx => {
        const project = await tx.project.create({
          data: {
            name: data.name,
            note: data.note,
            ownerId: userId,
            preferences: (data.preferences ?? {}) as any,
          },
        });

        // Create default roles for the project
        await this.roles.createDefaultRoles(project.id, tx);

        // Create default project template
        await this.createDefaultProjectTemplate(project.id, tx);

        this.logger.log(`Project "${project.name}" created by user ${userId}`);

        return project;
      },
      {
        maxWait: TRANSACTION_TIMEOUT.MAX_WAIT,
        timeout: TRANSACTION_TIMEOUT.TIMEOUT,
      },
    );
  }

  private async createDefaultProjectTemplate(projectId: string, tx: Prisma.TransactionClient) {
    this.logger.debug(`Creating default project template for project ${projectId}`);

    // Use i18n for default template name if possible, fallback to 'Standard'
    const name = this.i18n.t('project.default_template_name', { defaultValue: 'Standard' });

    return tx.projectTemplate.create({
      data: {
        projectId,
        name,
        language: null, // Applies to all languages
        order: 0,
        template: [
          { enabled: false, insert: 'title', before: '', after: '' },
          { enabled: true, insert: 'content', before: '', after: '' },
          { enabled: true, insert: 'authorComment', before: '', after: '' },
          { enabled: true, insert: 'authorSignature', before: '', after: '' },
          { enabled: true, insert: 'tags', before: '', after: '', tagCase: 'snake_case' },
          { enabled: false, insert: 'custom', before: '', after: '', content: '' },
          { enabled: true, insert: 'footer', before: '', after: '', content: '' },
        ] as any,
      },
    });
  }

  public async findAllForUser(
    userId: string,
    options?: {
      search?: string;
      includeArchived?: boolean;
      limit?: number;
      hasContentCollections?: boolean;
    },
  ) {
    const { search, includeArchived, limit, hasContentCollections } = options || {};

    const where: any = {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      ...(includeArchived ? {} : { archivedAt: null }),
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (hasContentCollections) {
      where.contentCollections = { some: {} };
    }

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        _count: {
          select: {
            members: true,
            channels: { where: { archivedAt: null } },
            publications: { where: { archivedAt: null } },
          },
        },
        members: { where: { userId }, select: { role: { select: { name: true } } } },
        publications: {
          where: { archivedAt: null },
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const projectIds = projects.map(p => p.id);
    if (projectIds.length === 0) return [];

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres');

    const statsMap = await ProjectStatsUtil.getStatsForProjects(this.prisma, projectIds);

    return projects.map(project => {
      const userMember = project.members.length > 0 ? project.members[0] : null;
      const lastPublicationAt = project.publications[0]?.createdAt || null;
      const lastPublicationId = project.publications[0]?.id || null;
      const stats = statsMap.get(project.id) || {};

      return {
        ...project,
        role: project.ownerId === userId ? 'owner' : userMember?.role?.name?.toLowerCase(),
        channelCount: project._count.channels,
        publicationsCount: project._count.publications,
        lastPublicationAt,
        lastPublicationId,
        languages: stats.languages || [],
        failedPostsCount: stats.failedPostsCount || 0,
        problemPublicationsCount: stats.problemPublicationsCount || 0,
        noCredentialsChannelsCount: stats.noCredentialsChannelsCount || 0,
        inactiveChannelsCount: stats.inactiveChannelsCount || 0,
        preferences: project.preferences || {},
        staleChannelsCount: stats.staleChannelsCount || 0,
      };
    });
  }

  public async findArchivedForUser(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        archivedAt: { not: null },
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        members: { where: { userId }, select: { role: { select: { name: true } } } },
        _count: { select: { channels: true, publications: true } },
        publications: {
          where: { archivedAt: null },
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true },
        },
        channels: {
          where: { archivedAt: null },
          select: {
            id: true,
            name: true,
            socialMedia: true,
            language: true,
            preferences: true,
            _count: { select: { posts: true } },
            posts: {
              where: { status: PostStatus.PUBLISHED, publication: { archivedAt: null } },
              take: 1,
              orderBy: { publishedAt: 'desc' },
              select: { publishedAt: true },
            },
          },
        },
      },
      orderBy: { archivedAt: 'desc' },
    });

    return projects.map(project => {
      const projectPrefs = (project.preferences as any) || {};
      let staleChannelsCount = 0;
      const mappedChannels = project.channels.map(c => {
        const channelPrefs = (c.preferences as any) || {};
        const lastPostAt = (c.posts as any[])[0]?.publishedAt || null;
        let isStale = false;
        if (lastPostAt) {
          const staleDays =
            channelPrefs.staleChannelsDays ||
            projectPrefs.staleChannelsDays ||
            DEFAULT_STALE_CHANNELS_DAYS;
          const diffDays = Math.ceil(
            Math.abs(Date.now() - new Date(lastPostAt).getTime()) / (1000 * 60 * 60 * 24),
          );
          isStale = diffDays > staleDays;
        }
        if (isStale) staleChannelsCount++;
        return { id: c.id, name: c.name, socialMedia: c.socialMedia, isStale };
      });

      return {
        ...project,
        channels: mappedChannels,
        role:
          project.ownerId === userId
            ? 'owner'
            : project.members.length > 0
              ? project.members[0].role?.name?.toLowerCase()
              : 'viewer',
        channelCount: project._count.channels,
        publicationsCount: project._count.publications,
        lastPublicationAt: project.publications[0]?.createdAt || null,
        lastPublicationId: project.publications[0]?.id || null,
        languages: [...new Set(project.channels.map(c => c.language))].sort(),
        failedPostsCount: 0,
        preferences: projectPrefs,
        staleChannelsCount,
      };
    });
  }

  public async findOne(projectId: string, userId: string, allowArchived = false): Promise<any> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        note: true,
        ownerId: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
        archivedBy: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            telegramUsername: true,
          },
        },
      },
    });

    if (!project || (!allowArchived && project.archivedAt)) {
      throw new NotFoundException('Project not found');
    }

    const role = await this.permissions.getUserProjectRole(projectId, userId);
    if (!role) throw new ForbiddenException('You are not a member of this project');

    const projectPrefs = (project.preferences as any) || {};
    const [
      memberCountRaw,
      channelCount,
      publicationsCount,
      lastPublication,
      channels,
      problemCount,
      inactiveCount,
      publicationsSummary,
      languagesRaw,
      failedPostsCount,
    ] = await Promise.all([
      this.prisma.projectMember.count({ where: { projectId } }),
      this.prisma.channel.count({ where: { projectId, archivedAt: null } }),
      this.prisma.publication.count({ where: { projectId, archivedAt: null } }),
      this.prisma.publication.findFirst({
        where: { projectId, status: PublicationStatus.PUBLISHED, archivedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true },
      }),
      this.prisma.channel.findMany({
        where: { projectId, archivedAt: null },
        select: {
          id: true,
          socialMedia: true,
          credentials: true,
          preferences: true,
          posts: {
            where: { status: PostStatus.PUBLISHED, publication: { archivedAt: null } },
            take: 1,
            orderBy: { publishedAt: 'desc' },
            select: { publishedAt: true, createdAt: true },
          },
        },
      }),
      this.prisma.publication.count({
        where: {
          projectId,
          status: {
            in: [PublicationStatus.FAILED, PublicationStatus.PARTIAL, PublicationStatus.EXPIRED],
          },
          archivedAt: null,
        },
      }),
      this.prisma.channel.count({ where: { projectId, archivedAt: null, isActive: false } }),
      ProjectStatsUtil.getPublicationsSummary(this.prisma, projectId),
      this.prisma.channel.groupBy({
        by: ['language'],
        where: { projectId, archivedAt: null },
      }),
      this.prisma.post.count({
        where: {
          status: PostStatus.FAILED,
          publication: { archivedAt: null },
          channel: { projectId, archivedAt: null },
        },
      }),
    ]);

    let staleChannelsCount = 0;
    let noCredentialsChannelsCount = 0;
    const nowMs = Date.now();

    for (const channel of channels) {
      if (!ChannelIssuesPattern.hasAccurateCredentialsLogic(channel.credentials as any, channel.socialMedia)) {
        noCredentialsChannelsCount++;
      }

      const channelPrefs = (channel.preferences as any) || {};
      const lastPostAt = channel.posts[0]?.publishedAt || channel.posts[0]?.createdAt || null;
      if (!lastPostAt) continue;

      const staleDays =
        channelPrefs.staleChannelsDays ||
        projectPrefs.staleChannelsDays ||
        DEFAULT_STALE_CHANNELS_DAYS;
      const diffDays = Math.ceil(
        Math.abs(nowMs - new Date(lastPostAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays > staleDays) staleChannelsCount++;
    }

    const memberCount = memberCountRaw + 1;
    const languages = languagesRaw
      .map(l => l.language)
      .filter((l): l is string => typeof l === 'string' && l.length > 0);

    return {
      ...project,
      role: role.toLowerCase(),
      channelCount,
      publicationsCount,
      memberCount,
      lastPublicationAt: lastPublication?.createdAt || null,
      lastPublicationId: lastPublication?.id || null,
      preferences: projectPrefs,
      staleChannelsCount,
      failedPostsCount,
      problemPublicationsCount: problemCount,
      noCredentialsChannelsCount,
      inactiveChannelsCount: inactiveCount,
      publicationsSummary,
      languages,
    };
  }

// Logic handled by ProjectStatsUtil

  public async update(projectId: string, userId: string, data: UpdateProjectDto) {
    const updateData: any = {
      ...data,
      preferences: data.preferences ? (data.preferences as any) : undefined,
    };

    if (data.version !== undefined) {
      updateData.version = data.version;
    }

    return this.updateWithVersion(projectId, data.version, updateData);
  }

  public async remove(projectId: string, userId: string) {
    // We allow either the owner OR someone with PROJECT_UPDATE permission to delete
    // The permission check above already validates this

    return this.prisma.project.delete({ where: { id: projectId } });
  }

  public async archive(projectId: string, userId: string): Promise<any> {
    const project = await this.findOneOrThrow(projectId, 'Project not found');
    return this.archiveRecord(projectId, userId);
  }

  public async unarchive(projectId: string, userId: string): Promise<any> {
    const project = await this.findOneOrThrow(projectId, 'Project not found');
    return this.unarchiveRecord(projectId, userId);
  }

  public async findMembers(projectId: string, userId: string) {
    // Any member can view members
    await this.permissions.checkProjectAccess(projectId, userId);

    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true, role: true },
    });

    // Manually fetch owner to append to the list (since OWNER role is removed from members table)
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { owner: true },
    });

    if (project && project.owner) {
      // Create a virtual member object for the owner
      // We cast to any to avoid type issues with the strictly generated ProjectMember type
      const ownerMember: any = {
        id: 'owner',
        projectId: project.id,
        userId: project.ownerId,
        role: 'OWNER', // Virtual role
        createdAt: project.createdAt,
        user: project.owner,
      };
      return [ownerMember, ...members];
    }

    return members;
  }

  public async addMember(projectId: string, userId: string, data: AddMemberDto) {
    let userToAdd;

    // Check if input is a Telegram ID (numeric)
    if (/^\d+$/.test(data.username)) {
      userToAdd = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(data.username) },
      });
    } else {
      userToAdd = await this.prisma.user.findFirst({
        where: { telegramUsername: data.username.replace(/^@/, '') },
      });
    }

    if (!userToAdd) {
      throw new NotFoundException(`User with identifier ${data.username} not found`);
    }

    const existingMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: userToAdd.id } },
    });

    if (existingMember) {
      throw new ForbiddenException('User is already a member of this project');
    }

    const member = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: userToAdd.id,
        roleId: data.roleId,
      },
      include: { user: true, role: true },
    });

    // Notify user about project invitation
    try {
      const [project, inviter] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId } }),
        this.prisma.user.findUnique({ where: { id: userId } }),
      ]);

      const inviterName = inviter
        ? inviter.fullName ||
          (inviter.telegramUsername ? `@${inviter.telegramUsername}` : 'Unknown User')
        : 'System';

      const lang = userToAdd.uiLanguage || 'en-US';

      await this.notifications.create({
        userId: userToAdd.id,
        type: 'PROJECT_INVITE' as any,
        title: this.i18n.t('notifications.PROJECT_INVITE_TITLE', { lang }),
        message: this.i18n.t('notifications.PROJECT_INVITE_MESSAGE', {
          lang,
          args: {
            inviterName,
            projectName: project?.name || 'Unknown',
          },
        }),
        meta: { projectId, invitedBy: userId },
      });
    } catch (error: any) {
      this.logger.error(`Failed to send project invitation notification: ${error.message}`);
    }

    return member;
  }

  public async updateMemberRole(
    projectId: string,
    userId: string,
    memberUserId: string,
    data: UpdateMemberDto,
  ) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: memberUserId } },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    return this.prisma.projectMember.update({
      where: { id: member.id },
      data: { roleId: data.roleId },
      include: { user: true, role: true },
    });
  }

  public async removeMember(projectId: string, userId: string, memberUserId: string) {
    this.logger.log(
      `removeMember: projectId=${projectId}, actor=${userId}, target=${memberUserId}`,
    );

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: memberUserId } },
    });

    if (!member) {
      this.logger.warn(
        `removeMember: Member not found. projectId=${projectId}, memberUserId=${memberUserId}`,
      );
      throw new NotFoundException('Member not found in this project');
    }

    return this.prisma.projectMember.delete({
      where: { id: member.id },
    });
  }

  public async searchNews(projectId: string, userId: string, query: SearchNewsQueryDto) {
    await this.permissions.checkProjectAccess(projectId, userId);

    const config = this.configService.get<NewsConfig>('news')!;
    let baseUrl = config.serviceUrl.replace(/\/$/, '');

    // Ensure we don't duplicate /api/v1 if it's already in the config
    if (!baseUrl.endsWith('/api/v1')) {
      baseUrl = `${baseUrl}/api/v1`;
    }

    const url = `${baseUrl}/news`;

    try {
      const searchParams: any = {
        q: query.q,
      };

      if (query.mode) searchParams.mode = query.mode;
      if (query.savedFrom) searchParams.savedFrom = query.savedFrom;
      if (query.savedTo) searchParams.savedTo = query.savedTo;
      if (query.afterSavedAt) searchParams.afterSavedAt = query.afterSavedAt;
      if (query.afterId) searchParams.afterId = query.afterId;
      if (query.cursor) searchParams.cursor = query.cursor;
      if (query.source) searchParams.sources = query.source;
      if (query.sources) searchParams.sources = query.sources;
      if (query.sourceTags) searchParams.sourceTags = query.sourceTags;
      if (query.includeContent) searchParams.includeContent = query.includeContent;

      if (query.lang) searchParams.locale = query.lang;

      if (query.limit) searchParams.limit = query.limit;
      if (query.minScore !== undefined) searchParams.minScore = query.minScore;
      if (query.orderBy) searchParams.orderBy = query.orderBy;

      const headers: Record<string, string> = {};
      if (config.apiToken) {
        headers['Authorization'] = `Bearer ${config.apiToken}`;
      }

      const timeoutMs = (config.requestTimeoutSecs ?? 30) * 1000;
      const { data } = await requestJsonWithRetry<any>({
        url,
        method: 'GET',
        headers,
        query: searchParams,
        timeoutMs,
        retry: this.retryConfig,
      });

      return data;
    } catch (error: any) {
      this.logger.error(`Failed to search news: ${error.message}`);
      throw error;
    }
  }

  public async fetchNewsContent(
    projectId: string,
    userId: string,
    newsId: string,
    data: FetchNewsContentDto,
  ) {
    this.logger.debug(
      `fetchNewsContent called for ${newsId}, contentLength: ${data.contentLength}, force: ${data.force}`,
    );
    await this.permissions.checkProjectAccess(projectId, userId);

    const config = this.configService.get<NewsConfig>('news')!;
    let baseUrl = config.serviceUrl.replace(/\/$/, '');
    if (!baseUrl.endsWith('/api/v1')) baseUrl += '/api/v1';

    try {
      const timeoutMs = (config.requestTimeoutSecs ?? 30) * 1000;

      let statusCode: number;
      let responseText: string;
      // If contentLength is 0 or no value (undefined/null), or force is true, we call refresh
      if (!data.contentLength || data.force) {
        this.logger.debug(`Refreshing news content for ${newsId}`);
        const url = `${baseUrl}/news/${newsId}/refresh`;

        let fingerprint: any = {};
        if (config.refreshFingerprint) {
          try {
            fingerprint = JSON.parse(config.refreshFingerprint);
          } catch (e) {
            this.logger.warn(
              `Failed to parse refreshFingerprint config: ${config.refreshFingerprint}`,
            );
          }
        }

        // We do not pass locale here, letting the microservice use the stored news item locale
        // to ensure consistency with the locale used during the initial crawling (listing).

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
        };

        const result = await requestTextWithRetry({
          url,
          method: 'POST',
          headers,
          body: JSON.stringify({
            fingerprint,
            mode: config.refreshMode,
          }),
          timeoutMs,
          retry: this.retryConfig,
        });

        statusCode = result.statusCode;
        responseText = result.text;
      } else {
        // Otherwise we just GET the news item which should already have content
        this.logger.debug(`Fetching existing news content for ${newsId}`);
        const url = `${baseUrl}/news/${newsId}`;

        // We do not pass locale query param to avoid implicit translation;
        // we want the item as it exists in the DB (original language/state).

        const headers: Record<string, string> = {};
        if (config.apiToken) {
          headers['Authorization'] = `Bearer ${config.apiToken}`;
        }

        const result = await requestTextWithRetry({
          url,
          method: 'GET',
          headers,
          timeoutMs,
          retry: this.retryConfig,
        });

        statusCode = result.statusCode;
        responseText = result.text;
      }

      if (statusCode >= 400) {
        this.logger.error(`News microservice returned ${statusCode}: ${responseText}`);

        // If it failed and we have fallback data, use it
        if (data.title || data.description) {
          this.logger.warn(
            `Using fallback data for news ${newsId} after service error ${statusCode}`,
          );
          return {
            title: data.title,
            content: data.description,
            description: data.description,
          };
        }

        throw new Error(`News microservice error: ${statusCode}`);
      }

      const result = JSON.parse(responseText || '{}');
      this.logger.debug(
        `Microservice response keys for news ${newsId}: ${Object.keys(result).join(', ')}`,
      );

      // Extract data with proper priority
      // 1. Check result.item (new API)
      // 2. Check result top level (original API/compatibility)
      const item = result.item || result;

      const content = item.content || item.body || item.text || item.original?.content;
      const title = item.title || item.original?.title || data.title;
      const description =
        item.description || item.summary || item.original?.description || data.description;

      // If we got an empty content from refresh/get, try fallback
      if (!content && (data.title || data.description)) {
        this.logger.warn(
          `No content found in microservice response for news ${newsId}, using fallback from DTO (description length: ${data.description?.length})`,
        );
        return {
          ...result,
          title: title || data.title,
          content: data.description,
          description: description || data.description,
        };
      }

      this.logger.debug(
        `Successfully fetched content for news ${newsId} (length: ${content?.length})`,
      );

      return {
        ...result,
        title,
        content,
        description,
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch news content: ${error.message}`);

      // Attempt fallback on catch as well
      if (data.title || data.description) {
        this.logger.warn(
          `Using fallback data for news ${newsId} after exception: ${error.message}`,
        );
        return {
          title: data.title,
          content: data.description,
          description: data.description,
        };
      }
      throw error;
    }
  }

  public async transfer(projectId: string, userId: string, data: TransferProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId) {
      throw new ForbiddenException('Only project owner can transfer project');
    }

    if (project.name !== data.projectName) {
      throw new ForbiddenException('Project name mismatch for confirmation');
    }

    let targetUser;

    // Check if input is a Telegram ID (numeric)
    if (/^\d+$/.test(data.targetUsername)) {
      targetUser = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(data.targetUsername) },
      });
    } else {
      targetUser = await this.prisma.user.findFirst({
        where: { telegramUsername: data.targetUsername.replace(/^@/, '') },
      });
    }

    if (!targetUser) {
      throw new NotFoundException(`User with identifier ${data.targetUsername} not found`);
    }

    return this.prisma.$transaction(
      async tx => {
        // 1. Update project owner
        const updatedProject = await tx.project.update({
          where: { id: projectId },
          data: { ownerId: targetUser.id },
        });

        // 2. Cascade ownership of publications is REMOVED to preserve audit history
        // createdBy should remain the original creator

        // 3. Optional: Clear channel credentials
        if (data.clearCredentials) {
          await tx.channel.updateMany({
            where: { projectId },
            data: { credentials: {} as any },
          });
        }

        // 4. Remove new owner from members if they were one
        await tx.projectMember.deleteMany({
          where: { projectId, userId: targetUser.id },
        });

        // 5. Notify the new owner
        try {
          const sender = await tx.user.findUnique({ where: { id: userId } });
          const senderName = sender
            ? sender.fullName ||
              (sender.telegramUsername ? `@${sender.telegramUsername}` : 'Unknown User')
            : 'Unknown User';

          const lang = targetUser.uiLanguage || 'en-US';

          await this.notifications.create(
            {
              userId: targetUser.id,
              type: 'PROJECT_TRANSFER' as any,
              title: this.i18n.t('notifications.PROJECT_TRANSFER_TITLE', { lang }),
              message: this.i18n.t('notifications.PROJECT_TRANSFER_MESSAGE', {
                lang,
                args: {
                  senderName,
                  projectName: project.name,
                },
              }),
              meta: { projectId, transferredBy: userId },
            },
            tx,
          );
        } catch (error: any) {
          this.logger.error(`Failed to send project transfer notification: ${error.message}`);
        }

        this.logger.log(
          `Project "${project.name}" (${project.id}) transferred from ${userId} to ${targetUser.id}`,
        );

        return updatedProject;
      },
      {
        maxWait: TRANSACTION_TIMEOUT.MAX_WAIT,
        timeout: TRANSACTION_TIMEOUT.TIMEOUT,
      },
    );
  }
}
// Force rebuild
