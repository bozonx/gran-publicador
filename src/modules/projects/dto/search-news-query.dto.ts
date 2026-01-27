import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsInt, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for searching news via microservice.
 */
export class SearchNewsQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_SEARCH_LENGTH)
  q!: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'vector', 'hybrid'])
  mode?: 'text' | 'vector' | 'hybrid';

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  since?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  sourceTags?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  newsTags?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  tags?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  lang?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  minScore?: number;
}
