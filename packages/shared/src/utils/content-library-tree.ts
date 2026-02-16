export interface ContentCollectionForCounters {
  id: string;
  type: 'GROUP' | 'SAVED_VIEW';
  parentId?: string | null;
  directItemsCount?: number;
}

/**
 * Calculates recursive item counts for nested groups.
 * Sums directItemsCount of the group itself and all its descendant groups.
 */
export function calculateRecursiveGroupCounters(collections: ContentCollectionForCounters[]): Map<string, number> {
  const memo = new Map<string, number>();
  const collectionById = new Map(collections.map((c) => [c.id, c]));
  
  const childrenByParentId = new Map<string, string[]>();
  for (const c of collections) {
    if (c.parentId) {
      const children = childrenByParentId.get(c.parentId) ?? [];
      children.push(c.id);
      childrenByParentId.set(c.parentId, children);
    }
  }

  const countForGroup = (groupId: string, trail: Set<string>): number => {
    if (memo.has(groupId)) {
      return memo.get(groupId)!;
    }

    if (trail.has(groupId)) {
      return 0; // Avoid cycles just in case
    }

    const group = collectionById.get(groupId);
    if (!group || group.type !== 'GROUP') {
      return 0;
    }

    trail.add(groupId);
    let total = Number(group.directItemsCount ?? 0);
    const childrenIds = childrenByParentId.get(groupId) ?? [];

    for (const childId of childrenIds) {
      total += countForGroup(childId, trail);
    }

    trail.delete(groupId);
    memo.set(groupId, total);
    return total;
  };

  for (const collection of collections) {
    if (collection.type === 'GROUP') {
      countForGroup(collection.id, new Set<string>());
    }
  }

  return memo;
}
