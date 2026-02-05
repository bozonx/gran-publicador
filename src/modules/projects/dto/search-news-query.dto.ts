import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
  MaxLength,
  IsIn,
  IsISO8601,
  IsArray,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for searching news via microservice.
 */
export class SearchNewsQueryDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_SEARCH_LENGTH)
  q?: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'vector', 'hybrid'])
  mode?: 'text' | 'vector' | 'hybrid';

  @IsOptional()
  @IsISO8601()
  savedFrom?: string;

  @IsOptional()
  @IsISO8601()
  savedTo?: string;

  @IsOptional()
  @IsISO8601()
  afterSavedAt?: string;

  @IsOptional()
  @IsString()
  afterId?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  sources?: string;

  @IsOptional()
  @IsString()
  sourceTags?: string;

  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;

  @IsOptional()
  @IsEnum(['relevance', 'savedAt'])
  orderBy?: 'relevance' | 'savedAt';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeContent?: boolean;
}
