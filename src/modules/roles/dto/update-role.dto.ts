import { IsString, IsOptional, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { RolePermissionsDto } from './create-role.dto.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public name?: string;

  @ValidateNested()
  @Type(() => RolePermissionsDto)
  @IsOptional()
  public permissions?: RolePermissionsDto;
}
