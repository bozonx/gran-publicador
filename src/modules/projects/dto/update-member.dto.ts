import { IsEnum } from 'class-validator';
import { ProjectRole } from '../../../generated/prisma/client.js';

export class UpdateMemberDto {
  // @IsEnum(ProjectRole)
  public role!: ProjectRole;
}
