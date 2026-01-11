import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsLocale,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { SocialMedia } from '../../../generated/prisma/client.js';

/**
 * DTO for creating a new social media channel.
 */
export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  public projectId!: string;

  @IsEnum(SocialMedia)
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  public socialMedia!: SocialMedia;

  @IsString()
  @IsNotEmpty()
  public name!: string;

  @IsString()
  @IsOptional()
  public description?: string;

  @IsString()
  @IsNotEmpty()
  public channelIdentifier!: string;

  @IsString()
  @IsNotEmpty()
  @IsLocale()
  public language!: string;

  @IsObject()
  @IsOptional()
  public credentials?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  public isActive?: boolean;

  @IsObject()
  @IsOptional()
  public preferences?: Record<string, any>;
}
