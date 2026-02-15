import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class LinkContentItemGroupDto {
  @IsIn(['personal', 'project'])
  public scope!: 'personal' | 'project';

  @IsUUID()
  @IsOptional()
  public projectId?: string;

  @IsUUID()
  public groupId!: string;
}
