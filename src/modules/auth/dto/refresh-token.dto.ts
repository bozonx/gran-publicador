import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for refresh token request.
 */
export class RefreshTokenDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  public refreshToken?: string;
}
