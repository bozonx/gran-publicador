import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for Telegram Login Widget authentication request.
 */
export class TelegramWidgetLoginDto {
  @IsNumber()
  @IsNotEmpty()
  public id!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_AUTH_NAME_LENGTH)
  public first_name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_AUTH_NAME_LENGTH)
  public last_name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_AUTH_NAME_LENGTH)
  public username?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  @MaxLength(VALIDATION_LIMITS.MAX_URL_LENGTH)
  public photo_url?: string;

  @IsNumber()
  @IsNotEmpty()
  public auth_date!: number;

  @IsString()
  @IsNotEmpty()
  public hash!: string;
}
