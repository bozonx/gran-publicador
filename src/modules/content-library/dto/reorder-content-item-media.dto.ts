import { ArrayMaxSize, IsArray, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

class ContentItemMediaOrderItemDto {
  @IsString()
  public id!: string;

  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_ORDER)
  @Max(VALIDATION_LIMITS.MAX_ORDER)
  public order!: number;
}

export class ReorderContentItemMediaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentItemMediaOrderItemDto)
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_MEDIA)
  public media!: ContentItemMediaOrderItemDto[];
}
