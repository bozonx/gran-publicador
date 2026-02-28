import { IsOptional, IsString } from 'class-validator';
import { CreateMediaDto } from '../../media/dto/index.js';

export class CreatePublicationMediaDto extends CreateMediaDto {
  @IsString()
  @IsOptional()
  public alt?: string;

  @IsString()
  @IsOptional()
  public description?: string;
}
