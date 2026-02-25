import { SocialMedia } from '../../../generated/prisma/index.js';
import { Type } from 'class-transformer';

export class ChannelProjectDto {
  public id!: string;
  public name!: string;
  public ownerId!: string;
  public archivedAt!: Date | null;
  public preferences!: Record<string, any>;
}

export class ChannelProblem {
  public type!: 'critical' | 'warning';
  public key!: string;
  public count?: number;
}

export class ChannelResponseDto {
  public id!: string;
  public projectId!: string;
  public socialMedia!: SocialMedia;
  public name!: string;
  public note!: string | null;
  public channelIdentifier!: string;
  public language!: string;
  public tags!: string | null;
  public isActive!: boolean;
  public createdAt!: Date;
  public updatedAt!: Date;
  public archivedAt!: Date | null;
  public archivedBy!: string | null;

  public credentials!: Record<string, any>;
  public preferences!: Record<string, any>;

  @Type(() => ChannelProjectDto)
  public project?: ChannelProjectDto;

  public role?: string;
  public postsCount!: number;
  public failedPostsCount!: number;

  public lastPostAt!: Date | null;
  public lastPostId!: string | null;
  public lastPublicationId!: string | null;

  public isStale!: boolean;

  public hasCredentials!: boolean;

  @Type(() => ChannelProblem)
  public problems!: ChannelProblem[];

  public templateVariations?: any[];
}
