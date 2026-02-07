export interface ArchiveQueryFlags {
  includeArchived?: boolean;
  archivedOnly?: boolean;
}

export function applyArchiveQueryFlags(
  params: Record<string, any>,
  flags: ArchiveQueryFlags | null | undefined,
): void {
  if (!flags) {
    delete params.includeArchived;
    delete params.archivedOnly;
    return;
  }

  if (flags.archivedOnly) {
    params.archivedOnly = true;
    delete params.includeArchived;
    return;
  }

  if (flags.includeArchived) {
    params.includeArchived = true;
    delete params.archivedOnly;
    return;
  }

  delete params.includeArchived;
  delete params.archivedOnly;
}
