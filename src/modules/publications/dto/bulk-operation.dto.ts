import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { PublicationStatus } from '../../../generated/prisma/client.js';

export enum BulkOperationType {
  DELETE = 'delete',
  ARCHIVE = 'archive',
  UNARCHIVE = 'unarchive',
  SET_STATUS = 'status',
}

export class BulkOperationDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsEnum(BulkOperationType)
  operation!: BulkOperationType;

  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;
}
