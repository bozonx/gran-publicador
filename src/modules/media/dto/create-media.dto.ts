import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { MediaType, MediaSourceType } from '../../../generated/prisma/client.js';

export class CreateMediaDto {
  @IsEnum(MediaType)
  type!: MediaType;

  @IsEnum(MediaSourceType)
  srcType!: MediaSourceType;

  @IsString()
  @IsNotEmpty()
  src!: string;

  @IsString()
  @IsNotEmpty()
  filename!: string;

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
