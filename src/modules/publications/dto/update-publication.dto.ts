import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  MaxLength,
  ArrayMaxSize,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PublicationStatus, PostType } from '../../../generated/prisma/index.js';
import { CreateMediaDto } from '../../media/dto/index.js';
import { ValidateNested } from 'class-validator';
import { IsUserStatus } from '../../../common/validators/index.js';

import { PublicationMediaInputDto } from './publication-media-input.dto.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';
import { PublicationMetaDto } from '../../../common/dto/json-objects.dto.js';

/**
 * DTO for updating an existing publication.
 */
export class UpdatePublicationDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_TITLE_LENGTH)
  public title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH)
  public description?: string;

  @ValidateIf(
    o =>
      ((o.status !== undefined && o.status !== PublicationStatus.DRAFT) ||
        o.scheduledAt !== undefined) &&
      o.content !== undefined &&
      !o.media?.length &&
      !o.existingMediaIds?.length,
  )
  @IsNotEmpty({
    message: 'Content is required for non-draft publications when no media is attached',
  })
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_PUBLICATION_CONTENT_LENGTH)
  public content?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_COMMENT_LENGTH)
  public authorComment?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_NOTE_LENGTH)
  public note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMediaDto)
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_MEDIA)
  public media?: CreateMediaDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicationMediaInputDto)
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_MEDIA)
  public existingMediaIds?: (string | PublicationMediaInputDto)[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_TAGS_COUNT)
  @MaxLength(VALIDATION_LIMITS.MAX_TAG_LENGTH, { each: true })
  public tags?: string[];

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public postDate?: Date;

  @IsUserStatus()
  @IsEnum(PublicationStatus)
  @IsOptional()
  public status?: PublicationStatus;

  @IsObject()
  @IsOptional()
  public meta?: any;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public scheduledAt?: Date | null;

  @IsEnum(PostType)
  @IsOptional()
  public postType?: PostType;

  @IsUUID()
  @IsOptional()
  public projectTemplateId?: string;
}
