import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class UpdateContentItemDto {
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

  @IsObject()
  @IsOptional()
  public meta?: Record<string, any>;
}
