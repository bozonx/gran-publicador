import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';

/**
 * DTO for updating an existing post.
 * Posts inherit content from Publication, so only channel-specific fields can be updated.
 */
export class UpdatePostDto {
  @IsString()
  @IsOptional()
  public tags?: string; // Can override publication tags

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public scheduledAt?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public publishedAt?: Date;
}
