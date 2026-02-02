import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsLocale,
  IsDate,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PublicationStatus, SocialMedia } from '../../../generated/prisma/index.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * Allowed fields for sorting publications
 */
export enum PublicationSortBy {
  CHRONOLOGY = 'chronology',
  BY_SCHEDULED = 'byScheduled',
  BY_PUBLISHED = 'byPublished',
  CREATED_AT = 'createdAt',
  SCHEDULED_AT = 'scheduledAt',
  PUBLISHED_AT = 'publishedAt',
  POST_DATE = 'postDate',
}

/**
 * Sort order
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum OwnershipType {
  OWN = 'own',
  NOT_OWN = 'notOwn',
}

export enum IssueType {
  FAILED = 'failed',
  PARTIAL = 'partial',
  EXPIRED = 'expired',
  PROBLEMATIC = 'problematic',
}

export enum DraftScope {
  PERSONAL = 'personal',
  PROJECTS = 'projects',
  ALL = 'all',
}

/**
 * DTO for query parameters when fetching publications
 */
export class FindPublicationsQueryDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsEnum(DraftScope)
  scope?: DraftScope;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').filter(v => v.length > 0);
    }
    return value;
  })
  status?: PublicationStatus | PublicationStatus[];

  @IsOptional()
  @IsString()
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @IsString()
  @IsLocale()
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  search?: string;

  @IsOptional()
  @IsEnum(OwnershipType)
  ownership?: OwnershipType;

  @IsOptional()
  @IsEnum(IssueType)
  issueType?: IssueType;

  @IsOptional()
  @IsEnum(SocialMedia)
  socialMedia?: SocialMedia;

  @IsOptional()
  @IsEnum(PublicationSortBy)
  sortBy?: PublicationSortBy;

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

  @IsOptional()
  @Transform(({ value }: { value: string | boolean }) => value === 'true' || value === true)
  @IsBoolean()
  archivedOnly?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAfter?: Date;
}
