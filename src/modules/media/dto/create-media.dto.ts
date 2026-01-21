import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min, IsNumber } from 'class-validator';
import { MediaType, StorageType } from '../../../generated/prisma/client.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class CreateMediaDto {
  @IsEnum(MediaType)
  type!: MediaType;

  @IsEnum(StorageType)
  storageType!: StorageType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_URL_LENGTH)
  storagePath!: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_FILENAME_LENGTH)
  filename?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_ALT_TEXT_LENGTH)
  alt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  mimeType?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== null && value !== undefined ? BigInt(value) : value))
  @IsNumber()
  @Min(VALIDATION_LIMITS.MIN_MEDIA_SIZE_BYTES)
  sizeBytes?: bigint;

  @IsObject()
  @IsOptional()
  @ArrayMaxSize?.(VALIDATION_LIMITS.MAX_REORDER_MEDIA) // Not array, but for safety of record size if needed later
  meta?: Record<string, any>;
}
