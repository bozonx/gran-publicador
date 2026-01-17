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
} from 'class-validator';
import { Type } from 'class-transformer';
import { PublicationStatus, PostType } from '../../../generated/prisma/client.js';
import { CreateMediaDto } from '../../media/dto/index.js';
import { ValidateNested } from 'class-validator';
import { IsUserStatus } from '../../../common/validators/index.js';
import { SourceTextDto } from './create-publication.dto.js';
import { PublicationMediaInputDto } from './publication-media-input.dto.js';

/**
 * DTO for updating an existing publication.
 */
export class UpdatePublicationDto {
  @IsString()
  @IsOptional()
  public title?: string;

  @IsString()
  @IsOptional()
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
  public content?: string;

  @IsString()
  @IsOptional()
  public authorComment?: string;

  @IsString()
  @IsOptional()
  public note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMediaDto)
  @IsOptional()
  public media?: CreateMediaDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicationMediaInputDto)
  @IsOptional()
  public existingMediaIds?: (string | PublicationMediaInputDto)[];

  @IsString()
  @IsOptional()
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
  public meta?: Record<string, any>;

  @IsString()
  @IsOptional()
  @IsLocale()
  public language?: string;

  @IsString()
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
  public linkToPublicationId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceTextDto)
  @IsOptional()
  public sourceTexts?: SourceTextDto[];

  @IsString()
  @IsOptional()
  public projectId?: string | null;

  @IsOptional()
  public appendSourceTexts?: boolean;
}
