import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  IsInt,
} from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class UpdateContentItemDto {
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  public groupId?: string | null;

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

  @IsInt()
  @IsOptional()
  public version?: number;
}
