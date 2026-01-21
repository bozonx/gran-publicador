import { IsBoolean, IsLocale, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for updating an existing channel.
 */
export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH)
  public description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_CHANNEL_IDENTIFIER_LENGTH)
  public channelIdentifier?: string;

  @IsString()
  @IsOptional()
  @IsLocale()
  public language?: string;

  @IsObject()
  @IsOptional()
  public credentials?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  public isActive?: boolean;

  @IsObject()
  @IsOptional()
  public preferences?: Record<string, any>;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  public tags?: string;
}

