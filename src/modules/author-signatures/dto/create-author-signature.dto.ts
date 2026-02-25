import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAuthorSignatureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content!: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  language?: string;

  @IsUUID()
  @IsOptional()
  userId?: string;
}
