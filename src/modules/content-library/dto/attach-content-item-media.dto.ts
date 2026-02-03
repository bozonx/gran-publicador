import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AttachContentItemMediaDto {
  @IsUUID()
  public mediaId!: string;

  @IsBoolean()
  @IsOptional()
  public hasSpoiler?: boolean;
}
