import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class FindContentLibraryTabsQueryDto {
  @IsIn(['personal', 'project'])
  public scope!: 'personal' | 'project';

  @IsUUID()
  @IsOptional()
  public projectId?: string;
}
