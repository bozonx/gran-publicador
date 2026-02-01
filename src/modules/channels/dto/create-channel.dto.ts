import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsLocale,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SocialMedia } from '../../../generated/prisma/index.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';
import { ChannelCredentialsDto, ChannelPreferencesDto } from '../../../common/dto/json-objects.dto.js';


/**
 * DTO for creating a new social media channel.
 */
export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  public projectId!: string;

  @IsEnum(SocialMedia)
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  public socialMedia!: SocialMedia;

  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH)
  public description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_CHANNEL_IDENTIFIER_LENGTH)
  public channelIdentifier!: string;

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
}
