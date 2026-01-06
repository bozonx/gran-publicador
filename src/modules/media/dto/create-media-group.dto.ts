import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MediaGroupItemDto {
  @IsString()
  @IsNotEmpty()
  mediaId!: string;

  @IsNumber()
  @IsOptional()
  order?: number;
}

export class CreateMediaGroupDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaGroupItemDto)
  items!: MediaGroupItemDto[];
}
