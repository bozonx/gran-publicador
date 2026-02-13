import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for updating an existing post.
 * Posts inherit content from Publication, so only channel-specific fields can be updated.
 */
export class UpdatePostDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_TAGS_COUNT)
  @MaxLength(VALIDATION_LIMITS.MAX_TAG_LENGTH, { each: true })
  public tags?: string[]; // Can override publication tags

  @Type(() => Date)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  public scheduledAt?: Date;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  public content?: string | null;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public publishedAt?: Date;

  @IsOptional()
  public meta?: any;

  @IsOptional()
  public platformOptions?: any;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  public authorSignature?: string;
}
