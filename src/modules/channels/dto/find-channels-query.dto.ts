import { IsOptional, IsEnum, IsString, IsInt, Min, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SocialMedia } from '../../../generated/prisma/client.js';

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
 * Sort order
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
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
}

/**
 * DTO for query parameters when fetching channels
 */
export class FindChannelsQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  search?: string;

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
  language?: string;

  @IsOptional()
  @IsEnum(ChannelSortBy)
  sortBy?: ChannelSortBy;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Transform(({ value }: { value: string | boolean }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;
}
