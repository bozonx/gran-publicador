import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
  IsObject,
} from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

class ContentItemMediaInputDto {
  @IsUUID()
  public mediaId!: string;

  @IsOptional()
  public hasSpoiler?: boolean;
}

export class SyncContentItemDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_TITLE_LENGTH)
  title?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_TAGS_COUNT)
  @MaxLength(VALIDATION_LIMITS.MAX_TAG_LENGTH, { each: true })
  tags?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_NOTE_LENGTH)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_SOURCE_TEXT_CONTENT_LENGTH)
  text?: string;

  @IsObject()
  @IsOptional()
  meta?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_MEDIA)
  mediaIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_MEDIA)
  media?: ContentItemMediaInputDto[];
}
