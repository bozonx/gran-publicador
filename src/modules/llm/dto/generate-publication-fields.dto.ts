import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsBoolean,
  ValidateNested,
  MaxLength,
  ArrayMaxSize,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * Channel info for publication fields generation.
 */
export class ChannelInfoDto {
  @IsString()
  @IsNotEmpty()
  channelId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  channelName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  socialMedia?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_TAGS_COUNT)
  tags?: string[];
}

/**
 * DTO for generating publication fields and per-channel post fields.
 */
export class GeneratePublicationFieldsDto {
  /**
   * The source text to extract/generate fields from.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_LLM_PROMPT_LENGTH)
  prompt!: string;

  /**
   * Publication language code (e.g. "ru-RU", "en-US").
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  publicationLanguage!: string;

  /**
   * Channels with posts in this publication.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelInfoDto)
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_CHANNELS_PER_PUBLICATION)
  channels!: ChannelInfoDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(VALIDATION_LIMITS.MAX_LLM_MAX_TOKENS)
  max_tokens?: number;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  model?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  tags?: string[];
}
