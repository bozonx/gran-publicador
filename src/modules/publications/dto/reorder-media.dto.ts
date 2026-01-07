import { IsArray, IsString, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MediaOrderItem {
  @IsString()
  id!: string;

  @IsNumber()
  order!: number;
}

export class ReorderMediaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaOrderItem)
  media!: MediaOrderItem[];
}
