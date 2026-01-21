import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for refresh token request.
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  public refreshToken!: string;
}
