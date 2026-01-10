import { IsString, IsOptional, IsArray } from 'class-validator';
import { Expose, Transform, Type } from 'class-transformer';

export class CreateApiTokenDto {
  @IsString()
  public name!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public scopeProjectIds?: string[];
}

export class UpdateApiTokenDto {
  @IsString()
  @IsOptional()
  public name?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  public scopeProjectIds?: string[];
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
  @Transform(({ value }) => (Array.isArray(value) ? value : []))
  public scopeProjectIds!: string[];

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
