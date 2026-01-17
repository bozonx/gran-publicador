import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAuthorSignatureDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  content?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsInt()
  @IsOptional()
  order?: number;
}
