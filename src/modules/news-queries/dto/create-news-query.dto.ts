import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
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

  @IsString()
  @IsNotEmpty()
  lang!: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  sourceTags?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  sources?: string;

  @IsNumber()
  @IsOptional()
  minScore?: number = 0.5;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  savedFrom?: string;

  @IsString()
  @IsOptional()
  savedTo?: string;

  @IsString()
  @IsOptional()
  orderBy?: 'relevance' | 'savedAt';

  @IsBoolean()
  @IsOptional()
  isNotificationEnabled?: boolean;
}
