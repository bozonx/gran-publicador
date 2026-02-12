import {
  IsOptional,
  IsString,
  IsObject,
  ValidateNested,
  IsBoolean,
  IsUUID,
  IsNumber,
  IsArray,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../constants/validation.constants.js';

/**
 * DTO for repost information.
 */
export class RepostInfoDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsNumber()
  chatId?: number;

  @IsOptional()
  @IsString()
  chatTitle?: string;

  @IsOptional()
  @IsString()
  chatUsername?: string;

  @IsOptional()
  @IsNumber()
  messageId?: number;

  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsNumber()
  authorId?: number;

  @IsOptional()
  @IsString()
  authorUsername?: string;
}

/**
 * DTO for Telegram-specific media metadata.
 */
export class TelegramMediaMetaDto {
  @IsString()
  @IsOptional()
  thumbnailFileId?: string;

  @IsBoolean()
  @IsOptional()
  hasSpoiler?: boolean;

  @IsBoolean()
  @IsOptional()
  isVoice?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RepostInfoDto)
  repost?: RepostInfoDto;
}

/**
 * DTO for Media metadata.
 */
export class MediaMetaDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramMediaMetaDto)
  telegram?: TelegramMediaMetaDto;
}

/**
 * DTO for Telegram origin tracking.
 */
export class TelegramOriginDto {
  @IsNumber()
  chatId!: number;

  @IsNumber()
  messageId!: number;

  @IsOptional()
  @IsObject()
  forwardOrigin?: any;
}

/**
 * DTO for Publication metadata.
 */
export class PublicationMetaDto {
  @IsOptional()
  @IsUUID()
  publicationId?: string;

  @IsOptional()
  @IsUUID()
  postId?: string;

  @IsOptional()
  @IsUUID()
  channelId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramOriginDto)
  telegramOrigin?: TelegramOriginDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RepostInfoDto)
  repost?: RepostInfoDto;

  @IsOptional()
  attempts?: number;

  @IsOptional()
  lastResult?: any;

  @IsOptional()
  @IsObject()
  newsData?: any;
}

/**
 * DTO for media optimization settings.
 */
export class MediaOptimizationDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsNumber()
  quality?: number;

  @IsOptional()
  @IsNumber()
  maxDimension?: number;

  @IsOptional()
  @IsBoolean()
  lossless?: boolean;

  @IsOptional()
  @IsBoolean()
  stripMetadata?: boolean;

  @IsOptional()
  @IsBoolean()
  autoOrient?: boolean;

  @IsOptional()
  @IsString()
  flatten?: string;

  @IsOptional()
  @IsString()
  chromaSubsampling?: string;

  @IsOptional()
  @IsNumber()
  effort?: number;

  @IsOptional()
  @IsBoolean()
  skipOptimization?: boolean;
}

/**
 * DTO for Project preferences.
 */
export class ProjectPreferencesDto {
  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @IsOptional()
  @IsBoolean()
  autoArchiveNotifications?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MediaOptimizationDto)
  mediaOptimization?: MediaOptimizationDto;

  @IsOptional()
  @IsNumber()
  staleChannelsDays?: number;
}

/**
 * DTO for Template Block.
 */
export class TemplateBlockDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  before?: string;

  @IsString()
  @IsIn(['title', 'content', 'tags', 'authorComment', 'authorSignature', 'footer', 'custom'])
  insert!: string;

  @IsOptional()
  @IsString()
  after?: string;

  @IsOptional()
  @IsString()
  tagCase?: string;

  @IsOptional()
  @IsString()
  content?: string;
}

/**
 * DTO for Channel Template Variation (linked to a project template).
 */
export class ChannelTemplateVariationDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsNumber()
  order!: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsString()
  projectTemplateId!: string;

  @IsOptional()
  @IsBoolean()
  excluded?: boolean;

  @IsOptional()
  @IsObject()
  overrides?: Record<string, any>;
}

/**
 * DTO for Channel preferences.
 */
export class ChannelPreferencesDto {
  @IsOptional()
  @IsBoolean()
  disableNotification?: boolean;

  @IsOptional()
  @IsBoolean()
  protectContent?: boolean;

  @IsOptional()
  @IsNumber()
  staleChannelsDays?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelTemplateVariationDto)
  templates?: ChannelTemplateVariationDto[];
}

/**
 * DTO for Channel credentials.
 * Support different social media credentials.
 */
export class ChannelCredentialsDto {
  // Telegram
  @IsOptional()
  @IsString()
  botToken?: string;

  @IsOptional()
  @IsString()
  chatId?: string;

  @IsOptional()
  @IsString()
  telegramBotToken?: string;

  @IsOptional()
  @IsString()
  telegramChannelId?: string;

  // Generic/Other
  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  vkAccessToken?: string;
}
