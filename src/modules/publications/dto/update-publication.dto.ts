import { IsArray, IsDate, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PublicationStatus, PostType } from '../../../generated/prisma/client.js';
import { CreateMediaDto, CreateMediaGroupDto } from '../../media/dto/index.js';
import { ValidateNested } from 'class-validator';
import { IsUserStatus } from '../../../common/validators/index.js';

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
  @Type(() => CreateMediaGroupDto)
  @IsOptional()
  public mediaGroups?: CreateMediaGroupDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public existingMediaIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public existingMediaGroupIds?: string[];

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
  public language?: string;

  @IsString()
  @IsOptional()
  public translationGroupId?: string | null;

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


}
