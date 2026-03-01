import { Prisma } from '../../../generated/prisma/index.js';
import { getPlatformConfig } from '@gran/shared/social-media-platforms';
import { DEFAULT_STALE_CHANNELS_DAYS } from '../../../common/constants/global.constants.js';

/**
 * Common repository patterns for filtering channels based on issues.
 */
export class ChannelIssuesPattern {
  public static getInactiveCondition(): Prisma.ChannelWhereInput {
    return { isActive: false };
  }

  public static getNoCredentialsCondition(): Prisma.ChannelWhereInput {
    return {
      OR: [{ credentials: { equals: {} } }, { credentials: { equals: Prisma.AnyNull } }],
    };
  }

  public static getFailedPostsCondition(): Prisma.ChannelWhereInput {
    return { posts: { some: { status: 'FAILED' } } };
  }

  public static getStaleCondition(staleDays?: number): Prisma.ChannelWhereInput {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - (staleDays ?? DEFAULT_STALE_CHANNELS_DAYS));
    
    return {
      AND: [
        { posts: { some: { status: 'PUBLISHED' } } },
        { posts: { none: { status: 'PUBLISHED', publishedAt: { gt: staleDate } } } },
      ],
    };
  }

  public static getProblematicCondition(staleDays?: number): Prisma.ChannelWhereInput {
    return {
      OR: [
        this.getInactiveCondition(),
        this.getNoCredentialsCondition(),
        this.getFailedPostsCondition(),
        this.getStaleCondition(staleDays),
      ],
    };
  }

  public static hasAccurateCredentialsLogic(creds: any, socialMedia?: string): boolean {
    if (!creds || typeof creds !== 'object') return false;

    if (socialMedia) {
      const config = getPlatformConfig(socialMedia as any);
      const requiredFields = config?.credentials?.filter((f: any) => f.required) ?? [];
      
      if (requiredFields.length > 0) {
        for (const f of requiredFields) {
          const value = creds[f.key];
          if (!value || String(value).trim().length === 0) {
            return false;
          }
        }
      }
    }

    const values = Object.values(creds);
    if (values.length === 0) return false;
    return !values.every((v: any) => !v || String(v).trim().length === 0);
  }
}
