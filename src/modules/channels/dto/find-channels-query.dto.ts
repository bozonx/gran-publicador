import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsLocale,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SocialMedia } from '../../../generated/prisma/index.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

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
  PROBLEMATIC = 'problematic',
}

/**
 * DTO for query parameters when fetching channels
 */
export class FindChannelsQueryDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
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
  @IsLocale()
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
  @Min(VALIDATION_LIMITS.MIN_PAGE_LIMIT)
  @Max(VALIDATION_LIMITS.MAX_PAGE_LIMIT)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_OFFSET)
  offset?: number;

  @IsOptional()
  @Transform(({ value }: { value: string | boolean }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;
}
