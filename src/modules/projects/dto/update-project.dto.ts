import { IsString, IsOptional, MaxLength, ValidateNested, IsObject, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';
import { ProjectPreferencesDto } from '../../../common/dto/json-objects.dto.js';

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
  public note?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectPreferencesDto)
  public preferences?: ProjectPreferencesDto;

  @IsInt()
  @IsOptional()
  public version?: number;
}
