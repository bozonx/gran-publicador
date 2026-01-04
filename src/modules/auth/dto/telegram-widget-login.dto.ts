import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * DTO for Telegram Login Widget authentication request.
 */
export class TelegramWidgetLoginDto {
  @IsNumber()
  @IsNotEmpty()
  public id!: number;

  @IsString()
  @IsNotEmpty()
  public first_name!: string;

  @IsString()
  @IsOptional()
  public last_name?: string;

  @IsString()
  @IsOptional()
  public username?: string;

  @IsString()
  @IsOptional()
  public photo_url?: string;

  @IsNumber()
  @IsNotEmpty()
  public auth_date!: number;

  @IsString()
  @IsNotEmpty()
  public hash!: string;
}
