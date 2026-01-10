import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FindProjectsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }: { value: string | boolean }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limit?: number;
}
