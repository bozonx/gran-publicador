import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class FetchNewsContentDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  contentLength?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
