import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class FindContentCollectionsQueryDto {
  @IsIn(['personal', 'project'])
  public scope!: 'personal' | 'project';

  @IsUUID()
  @IsOptional()
  public projectId?: string;
}
