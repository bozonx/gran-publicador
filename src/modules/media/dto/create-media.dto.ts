import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
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

  @IsOptional()
  @Transform(({ value }) => (value !== null && value !== undefined ? BigInt(value) : value))
  sizeBytes?: bigint;

  @IsObject()
  @IsOptional()
  meta?: Record<string, any>;
}
