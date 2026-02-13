import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PostStatus, PostType } from '../../../generated/prisma/index.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for creating a new post.
 * Posts now inherit content from their parent Publication.
 * Only channel-specific data is stored directly in Post.
 */
export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  public channelId!: string;

  @IsString()
  @IsNotEmpty()
  public publicationId!: string; // Now required - all posts must belong to a publication

  @IsString()
  @IsOptional()
  public socialMedia?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_TAGS_COUNT)
  @MaxLength(VALIDATION_LIMITS.MAX_TAG_LENGTH, { each: true })
  public tags?: string[]; // Can override publication tags

  @IsEnum(PostStatus)
  @IsOptional()
  public status?: PostStatus;

  @Type(() => Date)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDate()
  public scheduledAt?: Date;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  public content?: string | null;

  @IsOptional()
  public meta?: any;

  @IsOptional()
  public platformOptions?: any;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  public authorSignature?: string;
}
