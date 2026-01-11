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
} from 'class-validator';
import { Type } from 'class-transformer';
import { PublicationStatus, PostType } from '../../../generated/prisma/client.js';
import { CreateMediaDto } from '../../media/dto/index.js';
import { ValidateNested } from 'class-validator';
import { IsUserStatus } from '../../../common/validators/index.js';

/**
 * DTO for source text item in publication.
 */
export class SourceTextDto {
  @IsString()
  @IsNotEmpty()
  public content!: string;

  @IsNumber()
  @IsOptional()
  public order?: number;

  @IsString()
  @IsOptional()
  public source?: string;
}

/**
 * DTO for creating a new publication.
 */
export class CreatePublicationDto {
  @IsString()
  @IsNotEmpty()
  public projectId!: string;

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
  @IsString({ each: true })
  @IsOptional()
  public existingMediaIds?: string[];

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
  public createdBy?: string;

  @IsString()
  @IsNotEmpty()
  @IsLocale()
  public language!: string;

  @IsString()
  @IsOptional()
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
  public linkToPublicationId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public channelIds?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceTextDto)
  @IsOptional()
  public sourceTexts?: SourceTextDto[];
}
