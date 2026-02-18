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

  @IsIn(['GROUP', 'SAVED_VIEW', 'PUBLICATION_MEDIA_VIRTUAL', 'UNSPLASH'])
  public type!: 'GROUP' | 'SAVED_VIEW' | 'PUBLICATION_MEDIA_VIRTUAL' | 'UNSPLASH';

  @ValidateIf(o => o.type === 'GROUP' && o.scope === 'project')
  @IsIn(['PROJECT_USER', 'PROJECT_SHARED'])
  public groupType?: 'PROJECT_USER' | 'PROJECT_SHARED';

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
