import { IsString, IsOptional, IsArray } from 'class-validator';
import { Expose, Transform } from 'class-transformer';

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
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  })
  public scopeProjectIds!: string[];

  @Expose()
  public lastUsedAt?: Date | null;

  @Expose()
  public createdAt!: Date;

  @Expose()
  public updatedAt!: Date;
}
