import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class SyncContentBlockItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsInt()
  order!: number;

  @IsOptional()
  meta?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  mediaIds?: string[];
}

export class SyncContentBlocksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncContentBlockItemDto)
  blocks!: SyncContentBlockItemDto[];
}
