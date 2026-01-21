import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for updating an existing project.
 */
export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_PROJECT_NAME_LENGTH)
  public name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH)
  public description?: string;

  @IsObject()
  @IsOptional()
  public preferences?: Record<string, any>;
}

