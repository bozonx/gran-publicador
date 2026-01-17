import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAuthorSignatureDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  channelId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  content!: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
