import { IsArray, IsInt, IsNotEmpty, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Single item position in a reorder operation.
 */
export class ReorderItemDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  public publicationId!: string;

  @IsInt()
  @Min(0)
  public order!: number;
}

/**
 * DTO for reordering publications within a relation group.
 */
export class ReorderGroupDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  public items!: ReorderItemDto[];
}
