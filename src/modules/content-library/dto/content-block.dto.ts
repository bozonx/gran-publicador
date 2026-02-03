import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

class ContentBlockMediaInputDto {
  @IsUUID()
  public mediaId!: string;

  @IsOptional()
  public hasSpoiler?: boolean;

  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_ORDER)
  @Max(VALIDATION_LIMITS.MAX_ORDER)
  @IsOptional()
  public order?: number;
}

export class ContentBlockDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public type?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_SOURCE_TEXT_CONTENT_LENGTH)
  public text?: string;

  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_ORDER)
  @Max(VALIDATION_LIMITS.MAX_ORDER)
  @IsOptional()
  public order?: number;

  @IsObject()
  @IsOptional()
  public meta?: Record<string, any>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentBlockMediaInputDto)
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_MEDIA)
  public media?: ContentBlockMediaInputDto[];
}
