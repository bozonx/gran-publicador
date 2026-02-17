import { Exclude, Expose, Transform } from 'class-transformer';
import { IsBoolean, IsString, IsOptional } from 'class-validator';

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

  @IsOptional()
  public projectOrder?: string[];

  @IsOptional()
  public newsQueryOrder?: string[];

  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public contentLibraryCollectionOrder?: any;
}

export class BanUserDto {
  @IsString()
  @IsOptional()
  public reason?: string;
}
