import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAuthorSignatureDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  content?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
