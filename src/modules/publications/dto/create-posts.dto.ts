import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';

/**
 * DTO for creating posts from a publication.
 * Specifies target channels and optional scheduling.
 */
export class CreatePostsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one channel must be specified' })
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  public channelIds!: string[];

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public scheduledAt?: Date;
}
