import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

/**
 * DTO for unlinking a publication from a relation group.
 */
export class UnlinkPublicationDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  public groupId!: string;
}
