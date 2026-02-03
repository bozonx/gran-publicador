import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class UpdateContentItemDto {
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
}
