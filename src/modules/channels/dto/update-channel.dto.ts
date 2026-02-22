import {
  IsBoolean,
  IsLocale,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';
import {
  ChannelCredentialsDto,
  ChannelPreferencesDto,
} from '../../../common/dto/json-objects.dto.js';

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
  @ValidateNested()
  @Type(() => ChannelCredentialsDto)
  public credentials?: ChannelCredentialsDto;

  @IsBoolean()
  @IsOptional()
  public isActive?: boolean;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  public preferences?: ChannelPreferencesDto;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  public tags?: string;

  @IsInt()
  @IsOptional()
  public version?: number;
}
