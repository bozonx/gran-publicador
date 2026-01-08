import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { MediaType, StorageType } from '../../../generated/prisma/client.js';

export class UpdateMediaDto {
  @IsEnum(MediaType)
  @IsOptional()
  type?: MediaType;

  @IsEnum(StorageType)
  @IsOptional()
  storageType?: StorageType;

  @IsString()
  @IsOptional()
  storagePath?: string;

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
