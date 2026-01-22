import { IsNotEmpty, IsString, MaxLength, IsUUID } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_USERNAME_LENGTH)
  public username!: string;

  @IsUUID()
  public roleId!: string;
}

