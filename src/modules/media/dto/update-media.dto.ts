import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { MediaType, MediaSourceType } from '../../../generated/prisma/client.js';

export class UpdateMediaDto {
  @IsEnum(MediaType)
  @IsOptional()
  type?: MediaType;

  @IsEnum(MediaSourceType)
  @IsOptional()
  srcType?: MediaSourceType;

  @IsString()
  @IsOptional()
  src?: string;

  @IsString()
  @IsOptional()
  filename?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsNumber()
  @IsOptional()
  sizeBytes?: number;

  @IsObject()
  @IsOptional()
  meta?: Record<string, any>;
}
