import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SearchTagsQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  q?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  limit?: number;
}
