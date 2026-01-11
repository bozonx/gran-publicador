import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ProjectRole } from '../../../generated/prisma/client.js';

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  public username!: string;

  @IsEnum(ProjectRole)
  public role!: ProjectRole;
}
