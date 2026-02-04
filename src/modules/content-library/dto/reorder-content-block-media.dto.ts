import { ArrayMaxSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

class ContentBlockMediaOrderItemDto {
  @IsUUID()
  public id!: string;

  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_ORDER)
  @Max(VALIDATION_LIMITS.MAX_ORDER)
  public order!: number;
}

export class ReorderContentBlockMediaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentBlockMediaOrderItemDto)
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_MEDIA)
  public media!: ContentBlockMediaOrderItemDto[];
}
