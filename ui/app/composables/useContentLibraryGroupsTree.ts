export interface ContentLibraryGroupCollection {
  id: string;
  type: 'GROUP' | string;
  parentId: string | null;
  order: number;
  title: string;
  directItemsCount?: number;
}

export interface ContentLibraryTreeItem {
  label: string;
  value: string;
  defaultExpanded?: boolean;
  children?: ContentLibraryTreeItem[];
}

export function getRootGroupId(options: {
  activeGroupId: string;
  collectionsById: Map<string, ContentLibraryGroupCollection>;
}): string {
  let cursor = options.collectionsById.get(options.activeGroupId);
  const visited = new Set<string>();

  while (cursor?.parentId) {
    if (visited.has(cursor.id)) {
      break;
    }
    visited.add(cursor.id);

    const parent = options.collectionsById.get(cursor.parentId);
    if (!parent || parent.type !== 'GROUP') {
      break;
    }
    cursor = parent;
  }

  return cursor?.id ?? options.activeGroupId;
}

export function buildGroupTreeFromRoot(options: {
  rootId: string;
  allGroupCollections: ContentLibraryGroupCollection[];
  labelFn?: (c: ContentLibraryGroupCollection) => string;
}): ContentLibraryTreeItem[] {
  const byParent = new Map<string, ContentLibraryGroupCollection[]>();
  for (const c of options.allGroupCollections) {
    if (c.type !== 'GROUP') continue;
    const pid = c.parentId ?? '';
    const arr = byParent.get(pid) ?? [];
    arr.push(c);
    byParent.set(pid, arr);
  }

  const labelFn = options.labelFn ?? ((c: ContentLibraryGroupCollection) => c.title);

  const build = (parentId: string): ContentLibraryTreeItem[] => {
    const children = (byParent.get(parentId) ?? []).sort((a, b) => a.order - b.order);
    return children.map((c) => ({
      label: labelFn(c),
      value: c.id,
      defaultExpanded: true,
      children: build(c.id),
    }));
  };

  const root = options.allGroupCollections.find((c) => c.id === options.rootId && c.type === 'GROUP');
  if (!root) return [];

  return [
    {
      label: labelFn(root),
      value: root.id,
      defaultExpanded: true,
      children: build(root.id),
    },
  ];
}

export function buildDescendantsTree(options: {
  rootId: string;
  allGroupCollections: ContentLibraryGroupCollection[];
  labelFn?: (c: ContentLibraryGroupCollection) => string;
}): ContentLibraryTreeItem[] {
  const all = options.allGroupCollections.filter((c) => c.type === 'GROUP');
  const byParent = new Map<string, ContentLibraryGroupCollection[]>();
  for (const c of all) {
    const pid = c.parentId ?? '';
    const arr = byParent.get(pid) ?? [];
    arr.push(c);
    byParent.set(pid, arr);
  }

  const labelFn = options.labelFn ?? ((c: ContentLibraryGroupCollection) => c.title);

  const descendants = new Set<string>([options.rootId]);
  const queue = [options.rootId];
  while (queue.length > 0) {
    const pid = queue.shift();
    if (!pid) continue;
    for (const c of all) {
      if (c.parentId === pid && !descendants.has(c.id)) {
        descendants.add(c.id);
        queue.push(c.id);
      }
    }
  }

  const filteredByParent = new Map<string, ContentLibraryGroupCollection[]>();
  for (const c of all) {
    if (!descendants.has(c.id) || c.id === options.rootId) continue;
    const pid = c.parentId ?? '';
    const arr = filteredByParent.get(pid) ?? [];
    arr.push(c);
    filteredByParent.set(pid, arr);
  }

  const build = (parentId: string): ContentLibraryTreeItem[] => {
    const children = (filteredByParent.get(parentId) ?? []).sort((a, b) => a.order - b.order);
    return children.map((c) => ({
      label: labelFn(c),
      value: c.id,
      defaultExpanded: true,
      children: build(c.id),
    }));
  };

  return build(options.rootId);
}
