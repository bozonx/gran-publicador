import { IsString, IsOptional, IsArray, IsBoolean, MaxLength, ArrayMaxSize, IsUUID } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class CreateApiTokenDto {
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_TOKEN_NAME_LENGTH)
  public name!: string;

  @IsBoolean()
  @IsOptional()
  public allProjects?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_PROJECTS_PER_TOKEN)
  public projectIds?: string[];
}

export class UpdateApiTokenDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_TOKEN_NAME_LENGTH)
  public name?: string;

  @IsBoolean()
  @IsOptional()
  public allProjects?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  @IsOptional()
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_PROJECTS_PER_TOKEN)
  public projectIds?: string[];
}


export class ApiTokenDto {
  @Expose()
  public id!: string;

  @Expose()
  public userId!: string;

  @Expose()
  public name!: string;

  @Expose()
  public plainToken!: string;

  @Expose()
  public allProjects!: boolean;

  @Expose()
  public projectIds!: string[];

  @Expose()
  @Type(() => Date)
  public lastUsedAt?: Date | null;

  @Expose()
  @Type(() => Date)
  public createdAt!: Date;

  @Expose()
  @Type(() => Date)
  public updatedAt!: Date;
}
