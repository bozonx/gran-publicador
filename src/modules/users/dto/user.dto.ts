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

  @Exclude()
  public preferences!: string; // Internal use
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
}

export class BanUserDto {
  @IsString()
  @IsOptional()
  public reason?: string;
}
