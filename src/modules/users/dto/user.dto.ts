import { Exclude, Expose, Transform } from 'class-transformer';
import { IsBoolean, IsString, IsOptional, IsArray, IsInt, IsEnum } from 'class-validator';

export class UserDto {
  @Expose()
  public id!: string;

  @Expose()
  public fullName?: string | null;

  @Expose()
  public telegramUsername?: string | null;

  @Expose()
  public avatarUrl?: string | null;

  /**
   * The Telegram ID of the user.
   * Transformed to string to avoid BigInt serialization issues in JSON.
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  public telegramId?: string | null;

  @Expose()
  public isAdmin!: boolean;

  @Expose()
  public isSuperAdmin!: boolean;

  @Expose()
  public isBanned!: boolean;

  @Expose()
  public banReason?: string | null;

  @Expose()
  public createdAt!: Date;

  @Expose()
  public updatedAt!: Date;

  @Expose()
  public language!: string;

  @Expose()
  public uiLanguage!: string;

  @Expose()
  @Transform(({ obj }) => {
    const prefs = obj.preferences || {};
    return prefs.isUiLanguageAuto !== false;
  })
  public isUiLanguageAuto!: boolean;

  @Expose()
  @Transform(({ obj }) => {
    return obj.preferences?.projectOrder || [];
  })
  public projectOrder!: string[];

  @Expose()
  @Transform(({ obj }) => {
    return obj.preferences?.newsQueryOrder || [];
  })
  public newsQueryOrder!: string[];

  @Expose()
  @Transform(({ obj }) => {
    return obj.preferences?.contentLibraryCollectionOrder || null;
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public contentLibraryCollectionOrder!: any;

  @Expose()
  @Transform(({ obj }) => {
    const prefs = obj.preferences || {};
    return prefs.videoAutoplay !== false;
  })
  public videoAutoplay!: boolean;

  @Exclude({ toPlainOnly: true })
  public preferences!: any; // Internal use
}

export class UpdateUserAdminDto {
  @IsBoolean()
  public isAdmin!: boolean;
}

export class UpdateUserProfileDto {
  @IsString()
  @IsOptional()
  public fullName?: string;

  @IsString()
  @IsOptional()
  public avatarUrl?: string;

  @IsString()
  @IsOptional()
  public language?: string;

  @IsString()
  @IsOptional()
  public uiLanguage?: string;

  @IsBoolean()
  @IsOptional()
  public isUiLanguageAuto?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public projectOrder?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public newsQueryOrder?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public contentLibraryCollectionOrder?: string[];

  @IsBoolean()
  @IsOptional()
  public videoAutoplay?: boolean;

  @IsInt()
  @IsOptional()
  public version?: number;
}

export class NotificationPreferenceItemDto {
  @IsBoolean()
  @IsOptional()
  public internal?: boolean;

  @IsBoolean()
  @IsOptional()
  public telegram?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  public PUBLICATION_FAILED?: NotificationPreferenceItemDto;

  @IsOptional()
  public PROJECT_INVITE?: NotificationPreferenceItemDto;

  @IsOptional()
  public SYSTEM?: NotificationPreferenceItemDto;

  @IsOptional()
  public NEW_NEWS?: NotificationPreferenceItemDto;
}

export class BanUserDto {
  @IsString()
  @IsOptional()
  public reason?: string;
}

export enum UserSortBy {
  FULL_NAME = 'fullName',
  TELEGRAM_USERNAME = 'telegramUsername',
  CREATED_AT = 'createdAt',
  PUBLICATIONS_COUNT = 'publicationsCount',
}

import { BasePaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class FindUsersQueryDto extends BasePaginationQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  public isAdmin?: boolean;

  @IsOptional()
  @IsEnum(UserSortBy)
  public sortBy?: UserSortBy;
}
