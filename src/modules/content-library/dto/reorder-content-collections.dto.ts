import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class ReorderContentCollectionsDto {
  @IsIn(['personal', 'project'])
  public scope!: 'personal' | 'project';

  @IsUUID()
  @IsOptional()
  public projectId?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_PROMPTS)
  public ids!: string[];
}
