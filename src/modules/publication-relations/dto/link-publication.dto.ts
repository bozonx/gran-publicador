import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { RelationGroupType } from '../../../generated/prisma/index.js';

/**
 * DTO for linking a publication to another via a relation group.
 */
export class LinkPublicationDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  public targetPublicationId!: string;

  @IsEnum(RelationGroupType)
  public type!: RelationGroupType;
}
