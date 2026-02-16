export interface ContentLibraryTab {
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

export interface CreateTabDto {
  scope: 'personal' | 'project';
  projectId?: string;
  type: 'GROUP' | 'SAVED_VIEW';
  groupType?: 'PERSONAL_USER' | 'PROJECT_USER' | 'PROJECT_SHARED';
  parentId?: string;
  title: string;
  config?: Record<string, any>;
}

export interface UpdateTabDto {
  scope: 'personal' | 'project';
  projectId?: string;
  title?: string;
  config?: Record<string, any>;
}

export interface ReorderTabsDto {
  scope: 'personal' | 'project';
  projectId?: string;
  ids: string[];
}

export const useContentLibraryTabs = () => {
  const api = useApi();

  const listTabs = async (scope: 'personal' | 'project', projectId?: string) => {
    return api.get<ContentLibraryTab[]>('/content-library/tabs', {
      params: {
        scope,
        projectId: scope === 'project' ? projectId : undefined,
      },
    });
  };

  const createTab = async (dto: CreateTabDto) => {
    return api.post<ContentLibraryTab>('/content-library/tabs', dto);
  };

  const updateTab = async (tabId: string, dto: UpdateTabDto) => {
    return api.patch<ContentLibraryTab>(`/content-library/tabs/${tabId}`, dto);
  };

  const deleteTab = async (tabId: string, scope: 'personal' | 'project', projectId?: string) => {
    return api.delete(`/content-library/tabs/${tabId}`, {
      params: {
        scope,
        projectId: scope === 'project' ? projectId : undefined,
      },
    });
  };

  const reorderTabs = async (dto: ReorderTabsDto) => {
    return api.patch('/content-library/tabs/reorder', dto);
  };

  return {
    listTabs,
    createTab,
    updateTab,
    deleteTab,
    reorderTabs,
  };
};
