import { PartialType } from '@nestjs/mapped-types';
import { CreateNewsQueryDto } from './create-news-query.dto.js';
import { IsInt, IsOptional } from 'class-validator';

export class UpdateNewsQueryDto extends PartialType(CreateNewsQueryDto) {
  @IsInt()
  @IsOptional()
  public version?: number;
}
