import { Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PostStatus, PostType } from '../../../generated/prisma/client.js';

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

  @IsString()
  @IsOptional()
  public tags?: string; // Can override publication tags

  @IsEnum(PostStatus)
  @IsOptional()
  public status?: PostStatus;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public scheduledAt?: Date;
}
