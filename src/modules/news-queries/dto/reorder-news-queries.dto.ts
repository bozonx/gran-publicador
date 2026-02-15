import { IsArray, IsString, ArrayMaxSize } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class ReorderNewsQueriesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_BULK_IDS)
  public ids!: string[];
}
