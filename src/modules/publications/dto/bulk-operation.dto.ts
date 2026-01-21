import { IsArray, IsEnum, IsOptional, IsString, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { PublicationStatus } from '../../../generated/prisma/client.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export enum BulkOperationType {
  DELETE = 'DELETE',
  ARCHIVE = 'ARCHIVE',
  UNARCHIVE = 'UNARCHIVE',
  SET_STATUS = 'SET_STATUS',
}

export class BulkOperationDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_BULK_IDS)
  ids!: string[];

  @IsEnum(BulkOperationType)
  operation!: BulkOperationType;

  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;
}
