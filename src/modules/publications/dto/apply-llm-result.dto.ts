import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ApplyLlmPublicationDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  content?: string;
}

export class ApplyLlmPostDto {
  @IsString()
  channelId!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ApplyLlmResultDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ApplyLlmPublicationDto)
  publication?: ApplyLlmPublicationDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyLlmPostDto)
  posts?: ApplyLlmPostDto[];

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}
