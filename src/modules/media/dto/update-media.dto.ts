import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import { MediaType, StorageType } from '../../../generated/prisma/index.js';

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

  @IsOptional()
  @Transform(({ value }) => (value !== null && value !== undefined ? BigInt(value) : value))
  sizeBytes?: bigint;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsInt()
  height?: number;

  @IsObject()
  @IsOptional()
  meta?: Record<string, any>;

  @IsOptional()
  version?: number;
}
