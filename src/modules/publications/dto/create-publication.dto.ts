import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsLocale,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  MaxLength,
  ArrayMaxSize,
  IsInt,
  Min,
  Max,
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
 * DTO for creating a new publication.
 */
export class CreatePublicationDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  public projectId!: string;

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

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  public tags?: string;

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

  @IsString()
  @IsOptional()
  public createdBy?: string;

  @IsString()
  @IsNotEmpty()
  @IsLocale()
  public language!: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  public translationGroupId?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public scheduledAt?: Date;

  @IsEnum(PostType)
  @IsOptional()
  public postType?: PostType;

  @IsString()
  @IsOptional()
  @IsUUID()
  public linkToPublicationId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsUUID('all', { each: true })
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_CHANNELS_PER_PUBLICATION)
  public channelIds?: string[];


  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_URL_LENGTH)
  public imageUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  public newsItemId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsUUID('all', { each: true })
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_SOURCE_TEXTS)
  public contentItemIds?: string[];
}
