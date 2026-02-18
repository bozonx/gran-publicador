import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

class ContentItemMediaInputDto {
  @IsUUID()
  public mediaId!: string;

  @IsOptional()
  public hasSpoiler?: boolean;

  @IsOptional()
  public order?: number;
}

export class CreateContentItemDto {
  @IsIn(['personal', 'project'])
  public scope!: 'personal' | 'project';

  @IsUUID()
  @IsOptional()
  public projectId?: string;

  @IsUUID()
  @IsOptional()
  public groupId?: string;

  @IsUUID()
  @IsOptional()
  public publicationId?: string;

  @IsString()
  @IsOptional()
  public unsplashId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_TITLE_LENGTH)
  public title?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ArrayMinSize(0)
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_TAGS_COUNT)
  @MaxLength(VALIDATION_LIMITS.MAX_TAG_LENGTH, { each: true })
  public tags?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_NOTE_LENGTH)
  public note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_SOURCE_TEXT_CONTENT_LENGTH)
  public text?: string;

  @IsObject()
  @IsOptional()
  public meta?: Record<string, any>;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_MEDIA)
  public media?: ContentItemMediaInputDto[];
}
