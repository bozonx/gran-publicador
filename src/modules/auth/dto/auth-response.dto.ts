import { Expose, Type } from 'class-transformer';

import { UserDto } from '../../users/dto/user.dto.js';

/**
 * DTO for the authentication response.
 * Contains the JWT access token and user information.
 */
export class AuthResponseDto {
  @Expose()
  public accessToken!: string;

  @Expose()
  @Type(() => UserDto)
  public user!: UserDto;
}
