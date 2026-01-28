import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class CreateNewsQueryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  q?: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'vector', 'hybrid'])
  mode?: string = 'hybrid';

  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  sourceTags?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  newsTags?: string;

  @IsNumber()
  @IsOptional()
  minScore?: number = 0.5;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  since?: string;

  @IsBoolean()
  @IsOptional()
  isNotificationEnabled?: boolean;
}
