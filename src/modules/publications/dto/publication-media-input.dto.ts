import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for linking existing media to a publication with additional properties.
 */
export class PublicationMediaInputDto {
  @IsString()
  @IsNotEmpty()
  public id!: string;

  @IsBoolean()
  @IsOptional()
  public hasSpoiler?: boolean;
}
