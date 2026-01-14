import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { MediaType, StorageType } from '../../../generated/prisma/client.js';

export class CreateMediaDto {
  @IsEnum(MediaType)
  type!: MediaType;

  @IsEnum(StorageType)
  storageType!: StorageType;

  @IsString()
  @IsNotEmpty()
  storagePath!: string;

  @IsString()
  @IsOptional()
  filename?: string;

  @IsString()
  @IsOptional()
  alt?: string;

  @IsString()
  @IsOptional()
  description?: string;

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
