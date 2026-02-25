import { IsString, IsOptional, ValidateNested, MaxLength, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { RolePermissionsDto } from './create-role.dto.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH)
  public note?: string;

  @ValidateNested()
  @Type(() => RolePermissionsDto)
  @IsOptional()
  public permissions?: RolePermissionsDto;

  @IsInt()
  @IsOptional()
  public version?: number;
}
