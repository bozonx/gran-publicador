import { IsString, IsUrl, IsOptional, IsBoolean, IsInt, Min, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FingerprintDto {
  @IsOptional()
  @IsBoolean()
  generate?: boolean;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  timezoneId?: string;

  @IsOptional()
  @IsBoolean()
  rotateOnAntiBot?: boolean;

  @IsOptional()
  @IsBoolean()
  blockTrackers?: boolean;

  @IsOptional()
  @IsBoolean()
  blockHeavyResources?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  operatingSystems?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  devices?: string[];
}

export class ScrapePageDto {
  @IsString()
  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @IsIn(['extractor', 'playwright'])
  mode?: 'extractor' | 'playwright';

  @IsOptional()
  @IsBoolean()
  rawBody?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  taskTimeoutSecs?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => FingerprintDto)
  fingerprint?: FingerprintDto;
}
