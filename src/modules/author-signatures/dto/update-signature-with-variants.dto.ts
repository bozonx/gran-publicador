import { IsArray, IsInt, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpsertVariantDto } from './upsert-variant.dto.js';

export class SignatureVariantItemDto extends UpsertVariantDto {
  @IsOptional()
  language!: string;
}

export class UpdateSignatureWithVariantsDto {
  @IsInt()
  @IsOptional()
  order?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SignatureVariantItemDto)
  variants?: SignatureVariantItemDto[];
}
