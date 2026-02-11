import type { Tables } from './database.types';

export { ArchiveEntityType } from '@gran/shared/archive';

export type ArchiveEntityType = import('@gran/shared/archive').ArchiveEntityType;

export type { ArchiveStats } from '@gran/shared/archive';

export type { MoveEntityRequest as MoveEntityDto } from '@gran/shared/archive';

export type ArchivedProject = Tables<'projects'>;
export type ArchivedChannel = Tables<'channels'>;
export type ArchivedPublication = Tables<'publications'>;

export type ArchivedEntity = ArchivedProject | ArchivedChannel | ArchivedPublication;
