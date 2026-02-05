import {
  IsArray,
  IsString,
  IsNumber,
  IsInt,
  Min,
  Max,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

class MediaOrderItem {
  @IsString()
  id!: string;

  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_ORDER)
  @Max(VALIDATION_LIMITS.MAX_ORDER)
  order!: number;
}

export class ReorderMediaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaOrderItem)
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_MEDIA)
  media!: MediaOrderItem[];
}
