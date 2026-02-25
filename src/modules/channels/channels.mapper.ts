import { Injectable } from '@nestjs/common';
import { DEFAULT_STALE_CHANNELS_DAYS } from '../../common/constants/global.constants.js';
import { ChannelResponseDto, ChannelProblem } from './dto/channel-response.dto.js';
import { Prisma } from '../../generated/prisma/index.js';

@Injectable()
export class ChannelsMapper {
  /**
   * Safe extraction of JSON object.
   */
  private getJsonObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }

  /**
   * Mask credentials if needed. For now just provide hasCredentials flag.
   */
  private maskCredentials(credentials: any): Record<string, any> {
    const obj = this.getJsonObject(credentials);
    const masked: Record<string, any> = {};

    // We keep the keys but mask the values to allow the UI to know what is configured
    // but not reveal the actual tokens.
    for (const key of Object.keys(obj)) {
      const val = String(obj[key] || '');
      if (val.length > 20) {
        // Secure masking: reveal at most 20% of the token, max 4 chars at start and end
        const revealLength = Math.min(4, Math.floor(val.length * 0.1));
        masked[key] =
          val.substring(0, revealLength) + '...' + val.substring(val.length - revealLength);
      } else if (val.length > 0) {
        // Short tokens are fully masked for security
        masked[key] = '********';
      } else {
        masked[key] = '';
      }
    }
    return masked;
  }

  /**
   * Check if credentials are empty.
   */
  private hasCredentials(credentials: any, socialMedia: string): boolean {
    const creds = this.getJsonObject(credentials);
    const values = Object.values(creds);
    if (values.length === 0) return false;

    if (socialMedia === 'TELEGRAM') {
      const { telegramBotToken, telegramChannelId, botToken, chatId } = creds as any;
      const token = telegramBotToken || botToken;
      const id = telegramChannelId || chatId;
      return !!(token && String(token).trim().length > 0 && id && String(id).trim().length > 0);
    }

    if (socialMedia === 'VK') {
      const { vkAccessToken, accessToken } = creds as any;
      const token = vkAccessToken || accessToken;
      return !!(token && String(token).trim().length > 0);
    }

    return values.some(v => v !== null && v !== undefined && String(v).trim().length > 0);
  }

  /**
   * Calculate if channel is stale.
   */
  private calculateIsStale(lastPostAt: Date | null, channelPrefs: any, projectPrefs: any): boolean {
    if (!lastPostAt) return false;

    const staleDays =
      channelPrefs.staleChannelsDays ??
      (typeof projectPrefs.staleChannelsDays === 'number'
        ? projectPrefs.staleChannelsDays
        : undefined) ??
      DEFAULT_STALE_CHANNELS_DAYS;

    const diffDays = Math.ceil(
      Math.abs(Date.now() - new Date(lastPostAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays > staleDays;
  }

  /**
   * Detect channel problems.
   */
  private detectProblems(params: {
    hasCredentials: boolean;
    failedPostsCount: number;
    isStale: boolean;
    isActive: boolean;
  }): ChannelProblem[] {
    const problems: ChannelProblem[] = [];

    if (!params.hasCredentials) {
      problems.push({ type: 'critical', key: 'noCredentials' });
    }

    if (params.failedPostsCount > 0) {
      problems.push({
        type: 'critical',
        key: 'failedPosts',
        count: params.failedPostsCount,
      });
    }

    if (params.isStale) {
      problems.push({ type: 'warning', key: 'staleChannel' });
    }

    if (!params.isActive) {
      problems.push({ type: 'warning', key: 'inactiveChannel' });
    }

    return problems;
  }

  /**
   * Map Prisma Channel to DTO.
   */
  public mapToDto(
    channel: any,
    counts: { published: number; failed: number } = { published: 0, failed: 0 },
    role?: string,
  ): ChannelResponseDto {
    const { posts, credentials, preferences, project, _count, ...channelData } = channel;

    // Normalize preferences
    const channelPrefs = preferences;
    const projectPrefs = this.getJsonObject(project?.preferences);

    const lastPostAt = posts?.[0]?.publishedAt ?? posts?.[0]?.createdAt ?? null;
    const isStale = this.calculateIsStale(lastPostAt, channelPrefs, projectPrefs);
    const hasCredentials = this.hasCredentials(credentials, channelData.socialMedia);

    const problems = this.detectProblems({
      hasCredentials,
      failedPostsCount: counts.failed,
      isStale,
      isActive: channelData.isActive,
    });

    return {
      ...channelData,
      project,
      // Mask credentials in response
      credentials: this.maskCredentials(credentials),
      hasCredentials,
      problems,
      role: role?.toLowerCase(),
      postsCount: counts.published,
      failedPostsCount: counts.failed,
      lastPostAt,
      lastPostId: posts?.[0]?.id ?? null,
      lastPublicationId: posts?.[0]?.publicationId ?? null,
      isStale,
      preferences: channelPrefs,
    };
  }
}
