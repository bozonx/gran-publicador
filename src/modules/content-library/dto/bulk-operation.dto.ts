import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export enum BulkOperationType {
  DELETE = 'DELETE',
  ARCHIVE = 'ARCHIVE',
  UNARCHIVE = 'UNARCHIVE',
  SET_PROJECT = 'SET_PROJECT',
  MERGE = 'MERGE',
}

export class BulkOperationDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_BULK_IDS)
  ids!: string[];

  @IsEnum(BulkOperationType)
  operation!: BulkOperationType;

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
