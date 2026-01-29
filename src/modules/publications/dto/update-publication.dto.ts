import {
  IsArray,
  IsDate,
  IsEnum,
  IsLocale,
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
import { SourceTextDto } from './create-publication.dto.js';
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
  @ValidateNested()
  @Type(() => PublicationMetaDto)
  public meta?: PublicationMetaDto;

  @IsString()
  @IsOptional()
  @IsLocale()
  public language?: string;

  @IsString()
  @IsUUID('4')
  @ValidateIf((o) => o.translationGroupId !== null)
  @IsOptional()
  public translationGroupId?: string | null;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public scheduledAt?: Date | null;

  @IsEnum(PostType)
  @IsOptional()
  public postType?: PostType;

  @IsString()
  @IsOptional()
  @IsUUID('4')
  public linkToPublicationId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceTextDto)
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_SOURCE_TEXTS)
  public sourceTexts?: SourceTextDto[];

  @IsString()
  @IsUUID('4')
  @ValidateIf((o) => o.projectId !== null)
  @IsOptional()
  public projectId?: string | null;

  @IsOptional()
  public appendSourceTexts?: boolean;
}

