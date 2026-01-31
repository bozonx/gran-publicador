import { IsBoolean, IsOptional } from 'class-validator';

export class FetchNewsContentDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
