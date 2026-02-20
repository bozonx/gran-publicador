import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SocialPostingBodyFormatter } from './utils/social-posting-body.formatter.js';
import { ContentConverter } from '../../common/utils/content-converter.util.js';
import { formatTagsCsv } from '../../common/utils/tags.util.js';
import { getPlatformConfig } from '@gran/shared/social-media-platforms';
import { preformatMarkdownForPlatform } from '@gran/shared/social-posting/md-preformatter';
import type {
  PostingSnapshot,
  PostingSnapshotMedia,
} from './interfaces/posting-snapshot.interface.js';
import { POSTING_SNAPSHOT_VERSION } from './interfaces/posting-snapshot.interface.js';

@Injectable()
export class PostSnapshotBuilderService {
  private readonly logger = new Logger(PostSnapshotBuilderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build posting snapshots for all posts of a publication.
   * Fetches all required data (publication, posts, channels, templates)
   * and produces a frozen snapshot per post.
   */
  async buildForPublication(publicationId: string): Promise<void> {
    const publication = await (this.prisma.publication as any).findUnique({
      where: { id: publicationId },
      include: {
        tagObjects: true,
        media: {
          include: { media: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!publication) {
      this.logger.warn(`Publication ${publicationId} not found, skipping snapshot build`);
      return;
    }

    const posts = await (this.prisma.post as any).findMany({
      where: { publicationId },
      include: {
        channel: true,
        tagObjects: true,
      },
    });

    if (posts.length === 0) {
      this.logger.debug(`No posts for publication ${publicationId}, skipping snapshot build`);
      return;
    }

    const projectTemplates = await this.prisma.projectTemplate.findMany({
      where: { projectId: publication.projectId },
      orderBy: { order: 'asc' },
    });

    const snapshotMedia = this.buildMediaSnapshot(publication.media);
    const now = new Date();
    const nowIso = now.toISOString();

    const publicationTagsString = formatTagsCsv(
      publication.tagObjects?.map((t: any) => t?.normalizedName || t?.name).filter(Boolean),
    );

    for (const post of posts) {
      const postTagsStringRaw = formatTagsCsv(
        post.tagObjects?.map((t: any) => t?.normalizedName || t?.name).filter(Boolean),
      );
      const tagsString = postTagsStringRaw || publicationTagsString || null;

      const { body, bodyFormat, template } = this.buildBody(
        post,
        post.channel,
        publication,
        projectTemplates,
        tagsString,
      );

      const snapshot: PostingSnapshot = {
        version: POSTING_SNAPSHOT_VERSION,
        body,
        bodyFormat,
        media: snapshotMedia,
        meta: {
          createdAt: nowIso,
          publicationId: publication.id,
          postId: post.id,
          channelId: post.channelId,
          platform: post.channel?.socialMedia,
          inputs: {
            title: publication.title,
            content: post.content || publication.content,
            tags: tagsString,
            authorComment: publication.authorComment,
            postType: publication.postType,
            language: publication.language,
            authorSignature: post.authorSignature,
          },
          template,
        },
      };

      await this.prisma.post.update({
        where: { id: post.id },
        data: {
          postingSnapshot: snapshot as any,
          postingSnapshotCreatedAt: now,
        },
      });
    }

    this.logger.log(
      `Built posting snapshots for ${posts.length} posts of publication ${publicationId}`,
    );
  }

  /**
   * Clear posting snapshots for all posts of a publication.
   */
  async clearForPublication(publicationId: string): Promise<void> {
    await this.prisma.post.updateMany({
      where: { publicationId },
      data: {
        postingSnapshot: null as any,
        postingSnapshotCreatedAt: null,
      },
    });

    this.logger.log(`Cleared posting snapshots for publication ${publicationId}`);
  }

  /**
   * Build the final body text for a single post using templates + channel variations.
   * Applies platform-specific conversions (e.g., MD→HTML for Telegram).
   */
  private buildBody(
    post: any,
    channel: any,
    publication: any,
    projectTemplates: any[],
    tagsString: string | null,
  ): {
    body: string;
    bodyFormat: PostingSnapshot['bodyFormat'];
    template: NonNullable<PostingSnapshot['meta']>['template'];
  } {
    const formatted = SocialPostingBodyFormatter.formatWithMeta({
      data: {
        title: publication.title,
        content: post.content || publication.content,
        tags: tagsString,
        authorComment: publication.authorComment,
        postType: publication.postType,
        language: publication.language,
        authorSignature: post.authorSignature,
      },
      channel,
      projectTemplates,
      preferredProjectTemplateId: publication.projectTemplateId ?? null,
    });

    let body = formatted.body;
    let bodyFormat: PostingSnapshot['bodyFormat'] = 'markdown';

    body = preformatMarkdownForPlatform({
      platform: channel.socialMedia,
      markdown: body,
    });

    const platformConfig = channel.socialMedia ? getPlatformConfig(channel.socialMedia) : undefined;
    const configuredBodyFormat = platformConfig?.features.bodyFormat;
    if (configuredBodyFormat === 'html') {
      bodyFormat = 'html';
      body = ContentConverter.mdToTelegramHtml(body);
    } else if (configuredBodyFormat === 'markdown') {
      bodyFormat = 'markdown';
    } else if (configuredBodyFormat === 'plain') {
      bodyFormat = 'text';
    }

    return { body, bodyFormat, template: formatted.template };
  }

  /**
   * Build a stable media snapshot from publication media relations.
   */
  private buildMediaSnapshot(publicationMedia: any[]): PostingSnapshotMedia[] {
    if (!publicationMedia || publicationMedia.length === 0) return [];

    return publicationMedia
      .filter(pm => pm.media)
      .map(pm => ({
        mediaId: pm.media.id,
        type: pm.media.type,
        storageType: pm.media.storageType,
        storagePath: pm.media.storagePath,
        order: pm.order,
        hasSpoiler: pm.hasSpoiler ?? pm.media.meta?.telegram?.hasSpoiler ?? false,
        meta: pm.media.meta ?? {},
      }));
  }
}
