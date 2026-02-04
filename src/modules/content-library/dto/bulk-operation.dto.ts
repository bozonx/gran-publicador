import { IsArray, IsEnum, IsString, ArrayMaxSize, ArrayMinSize, IsOptional, IsUUID } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export enum BulkOperationType {
  DELETE = 'DELETE',
  ARCHIVE = 'ARCHIVE',
  UNARCHIVE = 'UNARCHIVE',
  SET_PROJECT = 'SET_PROJECT',
}

export class BulkOperationDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_BULK_IDS)
  ids!: string[];

  @IsEnum(BulkOperationType)
  operation!: BulkOperationType;

  // Optional project ID. If null or undefined, and operation is SET_PROJECT,
  // it might imply "personal" (null). But class-validator with plain strings
  // is tricky with null. Let's say if undefined it means personal?
  // Or force it. Let's use IsOptional + IsUUID.
  @IsOptional()
  @IsUUID(4)
  projectId?: string;
}
