import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PublicationRelationGroupType } from '../../../generated/prisma/index.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for creating a new publication based on the current one and linking them.
 */
export class CreateRelatedPublicationDto {
  @IsEnum(PublicationRelationGroupType)
  public type!: PublicationRelationGroupType;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_TITLE_LENGTH)
  public title?: string;

  @IsString()
  @IsOptional()
  public language?: string;
}
