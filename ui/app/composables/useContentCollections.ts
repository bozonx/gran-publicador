export interface ContentCollection {
  id: string;
  type: 'GROUP' | 'SAVED_VIEW';
  title: string;
  directItemsCount?: number;
  groupType?: 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED' | null;
  userId: string | null;
  projectId: string | null;
  parentId: string | null;
  order: number;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionDto {
  scope: 'personal' | 'project';
  projectId?: string;
  type: 'GROUP' | 'SAVED_VIEW';
  groupType?: 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED';
  parentId?: string;
  title: string;
  config?: Record<string, any>;
}

export interface UpdateCollectionDto {
  scope: 'personal' | 'project';
  projectId?: string;
  title?: string;
  config?: Record<string, any>;
}

export interface ReorderCollectionsDto {
  scope: 'personal' | 'project';
  projectId?: string;
  ids: string[];
}

export const useContentCollections = () => {
  const api = useApi();

  const listCollections = async (scope: 'personal' | 'project', projectId?: string) => {
    return api.get<ContentCollection[]>('/content-library/collections', {
      params: {
        scope,
        projectId: scope === 'project' ? projectId : undefined,
      },
    });
  };

  const createCollection = async (dto: CreateCollectionDto) => {
    return api.post<ContentCollection>('/content-library/collections', dto);
  };

  const updateCollection = async (collectionId: string, dto: UpdateCollectionDto) => {
    return api.patch<ContentCollection>(`/content-library/collections/${collectionId}`, dto);
  };

  const deleteCollection = async (collectionId: string, scope: 'personal' | 'project', projectId?: string) => {
    return api.delete(`/content-library/collections/${collectionId}`, {
      params: {
        scope,
        projectId: scope === 'project' ? projectId : undefined,
      },
    });
  };

  const reorderCollections = async (dto: ReorderCollectionsDto) => {
    return api.patch('/content-library/collections/reorder', dto);
  };

  return {
    listCollections,
    createCollection,
    updateCollection,
    deleteCollection,
    reorderCollections,
  };
};
