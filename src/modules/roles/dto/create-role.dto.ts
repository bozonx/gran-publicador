import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
  MaxLength,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RolePermissions } from '../../../common/types/permissions.types.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

class PermissionsSectionDto {
  @IsBoolean()
  read!: boolean;

  @IsBoolean()
  update!: boolean;
}

class ChannelsPermissionsDto {
  @IsBoolean()
  read!: boolean;

  @IsBoolean()
  create!: boolean;

  @IsBoolean()
  update!: boolean;

  @IsBoolean()
  delete!: boolean;
}

class PublicationsPermissionsDto {
  @IsBoolean()
  read!: boolean;

  @IsBoolean()
  create!: boolean;

  @IsBoolean()
  updateOwn!: boolean;

  @IsBoolean()
  updateAll!: boolean;

  @IsBoolean()
  deleteOwn!: boolean;

  @IsBoolean()
  deleteAll!: boolean;
}

export class RolePermissionsDto implements RolePermissions {
  @ValidateNested()
  @Type(() => PermissionsSectionDto)
  project!: PermissionsSectionDto;

  @ValidateNested()
  @Type(() => ChannelsPermissionsDto)
  channels!: ChannelsPermissionsDto;

  @ValidateNested()
  @Type(() => PublicationsPermissionsDto)
  publications!: PublicationsPermissionsDto;
}

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH)
  public description?: string;

  @ValidateNested()
  @Type(() => RolePermissionsDto)
  public permissions!: RolePermissionsDto;
}
