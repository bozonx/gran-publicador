import { IsArray, IsString, ArrayMaxSize } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for reordering project templates.
 */
export class ReorderProjectTemplatesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_BULK_IDS)
  public ids!: string[];
}
