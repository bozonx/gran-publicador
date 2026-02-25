import { IsOptional, IsEnum, IsString, IsBoolean, IsLocale, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { SocialMedia } from '../../../generated/prisma/index.js';
import { BasePaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

/**
 * Allowed fields for sorting channels
 */
export enum ChannelSortBy {
  ALPHABETICAL = 'alphabetical',
  SOCIAL_MEDIA = 'socialMedia',
  LANGUAGE = 'language',
  POSTS_COUNT = 'postsCount',
}

/**
 * Ownership filter type
 */
export enum OwnershipFilter {
  ALL = 'all',
  OWN = 'own',
  GUEST = 'guest',
}

/**
 * Issue type filter
 */
export enum IssueTypeFilter {
  ALL = 'all',
  NO_CREDENTIALS = 'noCredentials',
  FAILED_POSTS = 'failedPosts',
  STALE = 'stale',
  INACTIVE = 'inactive',
  PROBLEMATIC = 'problematic',
}

/**
 * DTO for query parameters when fetching channels
 */
export class FindChannelsQueryDto extends BasePaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsEnum(OwnershipFilter)
  ownership?: OwnershipFilter;

  @IsOptional()
  @IsEnum(IssueTypeFilter)
  issueType?: IssueTypeFilter;

  @IsOptional()
  @IsEnum(SocialMedia)
  socialMedia?: SocialMedia;

  @IsOptional()
  @IsString()
  @IsLocale()
  language?: string;

  @IsOptional()
  @IsEnum(ChannelSortBy)
  sortBy?: ChannelSortBy;

  @IsOptional()
  @Transform(({ value }: { value: string | boolean }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: string | boolean }) => value === 'true' || value === true)
  @IsBoolean()
  archivedOnly?: boolean;
}
