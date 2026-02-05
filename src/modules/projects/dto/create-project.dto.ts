import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';
import { ProjectPreferencesDto } from '../../../common/dto/json-objects.dto.js';

/**
 * DTO for creating a new project.
 */
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_PROJECT_NAME_LENGTH)
  public name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH)
  public description?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectPreferencesDto)
  public preferences?: ProjectPreferencesDto;
}
