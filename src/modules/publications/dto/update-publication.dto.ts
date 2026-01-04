import { IsArray, IsDate, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PublicationStatus, PostType } from '../../../generated/prisma/client.js';

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

  @IsArray()
  @IsOptional()
  public mediaFiles?: string[];

  @IsString()
  @IsOptional()
  public tags?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  public postDate?: Date;

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
}
