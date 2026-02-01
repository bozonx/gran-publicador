import { IsBoolean, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class FetchNewsContentDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  contentLength?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
