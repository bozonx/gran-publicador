import { IsInt, IsOptional } from 'class-validator';

export class UpdateAuthorSignatureDto {
  @IsInt()
  @IsOptional()
  order?: number;
}
