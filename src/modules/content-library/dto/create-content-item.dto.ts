import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';
import { ContentTextDto } from './content-text.dto.js';

class ContentItemMediaInputDto {
  @IsUUID()
  public mediaId!: string;

  @IsOptional()
  public hasSpoiler?: boolean;
}

export class CreateContentItemDto {
  @IsIn(['personal', 'project'])
  public scope!: 'personal' | 'project';

  @IsUUID()
  @IsOptional()
  public projectId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_TITLE_LENGTH)
  public title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  public tags?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_NOTE_LENGTH)
  public note?: string;

  @IsObject()
  @IsOptional()
  public meta?: Record<string, any>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentTextDto)
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_SOURCE_TEXTS)
  public texts?: ContentTextDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentItemMediaInputDto)
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_MEDIA)
  public media?: ContentItemMediaInputDto[];
}
