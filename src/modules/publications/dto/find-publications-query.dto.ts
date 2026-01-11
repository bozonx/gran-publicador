import { IsOptional, IsEnum, IsString, IsInt, Min, IsBoolean, IsLocale } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PublicationStatus, SocialMedia } from '../../../generated/prisma/client.js';

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
}

/**
 * DTO for query parameters when fetching publications
 */
export class FindPublicationsQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

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
  channelId?: string;

  @IsOptional()
  @IsString()
  @IsLocale()
  language?: string;

  @IsOptional()
  @IsString()
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
