import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * DTO for updating an existing channel.
 */
export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  public name?: string;

  @IsString()
  @IsOptional()
  public description?: string;

  @IsString()
  @IsOptional()
  public channelIdentifier?: string;

  @IsObject()
  @IsOptional()
  public credentials?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  public isActive?: boolean;

  @IsObject()
  @IsOptional()
  public preferences?: Record<string, any>;
}
