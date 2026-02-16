import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class CreateContentCollectionDto {
  @IsIn(['personal', 'project'])
  public scope!: 'personal' | 'project';

  @IsUUID()
  @IsOptional()
  public projectId?: string;

  @IsIn(['GROUP', 'SAVED_VIEW'])
  public type!: 'GROUP' | 'SAVED_VIEW';

  @ValidateIf(o => o.type === 'GROUP')
  @IsIn(['PERSONAL_USER', 'PROJECT_USER', 'PROJECT_SHARED'])
  @IsOptional()
  public groupType?: 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED';

  @IsUUID()
  @IsOptional()
  public parentId?: string;

  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public title!: string;

  @IsObject()
  @IsOptional()
  public config?: Record<string, unknown>;
}
