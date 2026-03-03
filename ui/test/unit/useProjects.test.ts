import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref, isRef } from 'vue';

const mockApi = {
  get: vi.fn(() => Promise.resolve({})),
  post: vi.fn(() => Promise.resolve({})),
  put: vi.fn(() => Promise.resolve({})),
  patch: vi.fn(() => Promise.resolve({})),
  delete: vi.fn(() => Promise.resolve({})),
  createAbortController: () => new AbortController(),
};

const mockArchive = {
  archiveEntity: vi.fn(() => Promise.resolve()),
  restoreEntity: vi.fn(() => Promise.resolve()),
};

vi.mock('~/composables/useApi', () => ({ useApi: () => mockApi }));
vi.mock('~/composables/useArchive', () => ({ useArchive: () => mockArchive }));
vi.mock('#imports', () => ({
    useApi: () => mockApi,
    useArchive: () => mockArchive,
    useRuntimeConfig: () => ({ public: {} }),
    useI18n: () => ({ t: (s: any) => String(s), locale: ref('ru') }),
    useApiAction: () => ({
        executeAction: async (fn: any) => {
            try { return [null, await fn()]; } catch (e) { return [e, null]; }
        }
    }),
    storeToRefs: (store: any) => {
        const refs: any = {};
        for (const key in store) {
            if (typeof store[key] !== 'function') {
                refs[key] = isRef(store[key]) ? store[key] : ref(store[key]);
            }
        }
        return refs;
    },
}));

import { useProjects } from '../../app/composables/useProjects';
import { useProjectsStore } from '../../app/stores/projects';

describe('useProjects', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('fetchProjects calls API and updates store', async () => {
        const mockProjects = [{ id: '1', name: 'Project 1' }];
        mockApi.get.mockResolvedValueOnce(mockProjects);
        
        const { fetchProjects } = useProjects();
        const res = await fetchProjects();
        
        expect(mockApi.get).toHaveBeenCalledWith('/projects', expect.objectContaining({ params: expect.any(Object) }));
        expect(res).toEqual(mockProjects);
        
        const store = useProjectsStore();
        expect(store.projects).toEqual(mockProjects);
    });

    it('fetchProject calls API and sets current project', async () => {
        const mockProject = { id: '1', name: 'Project 1' };
        mockApi.get.mockResolvedValueOnce(mockProject);
        
        const { fetchProject } = useProjects();
        const res = await fetchProject('1');
        
        expect(mockApi.get).toHaveBeenCalledWith('/projects/1', expect.any(Object));
        expect(res).toEqual(mockProject);
        
        const store = useProjectsStore();
        expect(store.currentProject).toEqual(mockProject);
    });

    it('createProject calls API and refetches list', async () => {
        const newProject = { id: '2', name: 'New Project' };
        mockApi.post.mockResolvedValueOnce(newProject);
        mockApi.get.mockResolvedValueOnce([]); // for refetch
        
        const { createProject } = useProjects();
        const res = await createProject({ name: 'New Project' });
        
        expect(mockApi.post).toHaveBeenCalledWith('/projects', { name: 'New Project' });
        expect(mockApi.get).toHaveBeenCalledWith('/projects', expect.any(Object));
        expect(res).toEqual(newProject);
    });

    it('deleteProject calls API and removes from store', async () => {
        const store = useProjectsStore();
        store.setProjects([{ id: '1', name: 'P' } as any]);
        
        mockApi.delete.mockResolvedValueOnce({});
        
        const { deleteProject } = useProjects();
        const res = await deleteProject('1');
        
        expect(mockApi.delete).toHaveBeenCalledWith('/projects/1');
        expect(res).toBe(true);
        expect(store.projects).toHaveLength(0);
    });

    it('archiveProject calls archiveEntity and refetches', async () => {
        mockApi.get.mockResolvedValueOnce({ id: '1', isArchived: true });
        
        const { archiveProject } = useProjects();
        await archiveProject('1');
        
        expect(mockArchive.archiveEntity).toHaveBeenCalledWith('project', '1');
        expect(mockApi.get).toHaveBeenCalledWith('/projects/1', expect.any(Object));
    });

    it('canEdit returns correctly based on helper', () => {
        const { canEdit } = useProjects();
        const project = { id: '1', ownerId: '1' } as any;
        expect(typeof canEdit(project)).toBe('boolean');
    });
});
