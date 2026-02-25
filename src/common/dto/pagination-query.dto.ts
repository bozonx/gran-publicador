import { IsOptional, IsEnum, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../constants/validation.constants.js';

/**
 * Common sort orders
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Base DTO for paginated queries with common parameters.
 */
export class BasePaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_PAGE_LIMIT)
  @Max(VALIDATION_LIMITS.MAX_PAGE_LIMIT)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_OFFSET)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_SEARCH_LENGTH)
  search?: string;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
