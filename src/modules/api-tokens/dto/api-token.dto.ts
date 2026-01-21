import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { Expose, Type } from 'class-transformer';

export class CreateApiTokenDto {
  @IsString()
  public name!: string;

  @IsBoolean()
  @IsOptional()
  public allProjects?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public projectIds?: string[];
}

export class UpdateApiTokenDto {
  @IsString()
  @IsOptional()
  public name?: string;

  @IsBoolean()
  @IsOptional()
  public allProjects?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
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
