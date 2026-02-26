import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { PublicationRelationGroupType } from '../../../generated/prisma/index.js';

/**
 * DTO for linking a publication to another via a relation group.
 */
export class LinkPublicationDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  public targetPublicationId!: string;

  @IsEnum(PublicationRelationGroupType)
  public type!: PublicationRelationGroupType;
}
