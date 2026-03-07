import { IsString, IsOptional, IsInt, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class VfsListQueryDto {
  @IsString()
  @IsOptional()
  path?: string = '/';

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}

export enum VfsMediaType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  TEXT = 'text',
  DOCUMENT = 'document',
}

export class VfsSearchQueryDto {
  @IsString()
  query!: string;

  @IsString({ each: true })
  @IsOptional()
  @Type(() => {
    return String;
  })
  tags?: string[];

  @IsString()
  @IsOptional()
  type?: VfsMediaType;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}

export class VfsCreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class VfsUpdateCollectionDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class VfsUpdateItemDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
