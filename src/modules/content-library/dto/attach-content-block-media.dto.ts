import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class AttachContentBlockMediaDto {
  @IsUUID()
  public mediaId!: string;

  @IsBoolean()
  @IsOptional()
  public hasSpoiler?: boolean;

  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_ORDER)
  @Max(VALIDATION_LIMITS.MAX_ORDER)
  @IsOptional()
  public order?: number;
}
