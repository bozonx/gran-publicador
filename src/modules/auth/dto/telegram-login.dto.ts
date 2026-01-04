import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for Telegram authentication request.
 */
export class TelegramLoginDto {
  @IsString()
  @IsNotEmpty()
  public initData!: string;
}
