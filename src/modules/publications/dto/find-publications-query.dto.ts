import {
  IsOptional,
  IsEnum,
  IsString,
  IsArray,
  IsBoolean,
  IsLocale,
  IsDate,
  MaxLength,
  ArrayMaxSize,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PublicationStatus, SocialMedia } from '../../../generated/prisma/index.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';
import { BasePaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

/**
 * Allowed fields for sorting publications
 */
export enum PublicationSortBy {
  CHRONOLOGY = 'chronology',
  BY_SCHEDULED = 'byScheduled',
  BY_PUBLISHED = 'byPublished',
  CREATED_AT = 'createdAt',
  SCHEDULED_AT = 'scheduledAt',
  POST_DATE = 'postDate',
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
  PROJECTS = 'projects',
}

/**
 * DTO for query parameters when fetching publications
 */
export class FindPublicationsQueryDto extends BasePaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsEnum(DraftScope)
  public scope?: DraftScope;

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
  @IsEnum(OwnershipType)
  ownership?: OwnershipType;

  @IsOptional()
  @IsEnum(IssueType)
  issueType?: IssueType;

  @IsOptional()
  @IsEnum(SocialMedia)
  socialMedia?: SocialMedia;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_TAGS_COUNT)
  @MaxLength(VALIDATION_LIMITS.MAX_TAG_LENGTH, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(PublicationSortBy)
  sortBy?: PublicationSortBy;

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

  @IsOptional()
  @Transform(({ value }: { value: string | boolean }) => value === 'true' || value === true)
  @IsBoolean()
  withMedia?: boolean;
}
