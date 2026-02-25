import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { BasePaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class FindContentCollectionsQueryDto extends BasePaginationQueryDto {
  @IsIn(['personal', 'project'])
  public scope!: 'personal' | 'project';

  @IsUUID()
  @IsOptional()
  public projectId?: string;
}
