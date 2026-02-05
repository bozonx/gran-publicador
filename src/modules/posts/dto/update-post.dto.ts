import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, ValidateIf } from 'class-validator';

/**
 * DTO for updating an existing post.
 * Posts inherit content from Publication, so only channel-specific fields can be updated.
 */
export class UpdatePostDto {
  @IsString()
  @IsOptional()
  public tags?: string; // Can override publication tags

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
  public template?: any;

  @IsOptional()
  public platformOptions?: any;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  public footerId?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  public authorSignature?: string;
}
