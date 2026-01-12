import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { PublicationStatus } from '../../../generated/prisma/client.js';

export enum BulkOperationType {
  DELETE = 'DELETE',
  ARCHIVE = 'ARCHIVE',
  UNARCHIVE = 'UNARCHIVE',
  SET_STATUS = 'SET_STATUS',
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
