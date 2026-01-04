import { IsNotEmpty, IsUUID } from 'class-validator';

export enum ArchiveEntityType {
  PROJECT = 'project',
  CHANNEL = 'channel',
  PUBLICATION = 'publication',
}

export class MoveEntityDto {
  @IsUUID()
  @IsNotEmpty()
  public targetParentId!: string;
}

export class ArchiveStatsDto {
  public projects!: number;
  public channels!: number;
  public publications!: number;
  public posts!: number;
  public total!: number;
}
