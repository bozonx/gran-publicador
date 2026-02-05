import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MediaType, StorageType } from '../../../generated/prisma/index.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';
import { IsBigInt, MinBigInt } from '../../../common/validators/index.js';
import { MediaMetaDto } from '../../../common/dto/json-objects.dto.js';

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
  @IsBigInt()
  @MinBigInt(VALIDATION_LIMITS.MIN_MEDIA_SIZE_BYTES)
  sizeBytes?: bigint;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => MediaMetaDto)
  meta?: MediaMetaDto;
}
