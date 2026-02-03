import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class FindContentItemsQueryDto {
  @IsIn(['personal', 'project'])
  public scope!: 'personal' | 'project';

  @IsUUID()
  @IsOptional()
  public projectId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_SEARCH_LENGTH)
  public search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_PAGE_LIMIT)
  @Max(VALIDATION_LIMITS.MAX_PAGE_LIMIT)
  @IsOptional()
  public limit?: number;

  @Type(() => Number)
  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_OFFSET)
  @IsOptional()
  public offset?: number;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return Boolean(value);
  })
  public includeArchived?: boolean;
}
