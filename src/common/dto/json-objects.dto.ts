import { IsOptional, IsString, IsObject, ValidateNested, IsBoolean, IsUUID, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsUUID('4')
  publicationId?: string;

  @IsOptional()
  @IsUUID('4')
  postId?: string;

  @IsOptional()
  @IsUUID('4')
  channelId?: string;

  @IsOptional()
  @IsUUID('4')
  projectId?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TelegramOriginDto)
  telegramOrigin?: TelegramOriginDto;
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

  // Generic/Other
  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}
