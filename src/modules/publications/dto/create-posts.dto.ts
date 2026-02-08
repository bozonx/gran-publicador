import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

/**
 * DTO for creating posts from a publication.
 * Specifies target channels, optional scheduling, and author signature selection.
 */
export class CreatePostsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one channel must be specified' })
  @ArrayUnique()
  @IsUUID('all', { each: true })
  @IsNotEmpty()
  public channelIds!: string[];

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public scheduledAt?: Date;

  // Project author signature ID to resolve variant content by channel language
  @IsUUID()
  @IsOptional()
  public authorSignatureId?: string;

  // Per-channel signature text overrides (channelId → content string)
  @IsObject()
  @IsOptional()
  public authorSignatureOverrides?: Record<string, string>;
}
