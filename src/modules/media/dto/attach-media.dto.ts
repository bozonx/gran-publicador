import { IsArray, IsOptional, IsString } from 'class-validator';

export class AttachMediaDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mediaGroupIds?: string[];
}
