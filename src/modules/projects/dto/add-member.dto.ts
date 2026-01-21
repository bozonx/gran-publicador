import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ProjectRole } from '../../../generated/prisma/client.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_USERNAME_LENGTH)
  public username!: string;

  @IsEnum(ProjectRole)
  public role!: ProjectRole;
}
// Force rebuild
