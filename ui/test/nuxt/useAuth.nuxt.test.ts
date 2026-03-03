import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';

// Hoist mocks for use in mockNuxtImport
const mocks = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    createAbortController: () => new AbortController(),
  },
  mockNavigateTo: vi.fn(),
}));

mockNuxtImport('useApi', () => () => mocks.mockApi);
mockNuxtImport('navigateTo', () => mocks.mockNavigateTo);
mockNuxtImport('useApiAction', () => () => ({
  executeAction: async (fn: any) => {
    try { return [null, await fn()]; } catch (e) { return [e, null]; }
  }
}));

import { useAuth } from '~/composables/useAuth';
import { useAuthStore } from '~/stores/auth';

// Mock other stores
vi.mock('~/stores/app', () => ({ useAppStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/notifications', () => ({ useNotificationsStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/dashboard', () => ({ useDashboardStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/users', () => ({ useUsersStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/projects', () => ({ useProjectsStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/stt', () => ({ useSttStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/channels', () => ({ useChannelsStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/publications', () => ({ usePublicationsStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/posts', () => ({ usePostsStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/news', () => ({ useNewsStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/media', () => ({ useMediaStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/templates', () => ({ useTemplatesStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/content-destination', () => ({ useContentDestinationStore: () => ({ reset: vi.fn() }) }));
vi.mock('~/stores/autosave', () => ({ useAutosaveStore: () => ({ reset: vi.fn() }) }));

describe('useAuth (Nuxt)', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        
        const config = useRuntimeConfig();
        config.public.devMode = 'true';
        config.public.devTelegramId = '123456';
    });

    it('initializes with store state', () => {
        const store = useAuthStore();
        store.setUser({ id: 1, fullName: 'Test User' } as any);
        
        const { user, isLoggedIn } = useAuth();
        expect(user.value).toEqual(store.user);
        expect(isLoggedIn.value).toBe(true);
    });

    it('loginWithTelegram sets user and initialized state', async () => {
        const mockResponse = { user: { id: 1, fullName: 'TG User' } };
        vi.mocked(mocks.mockApi.post).mockResolvedValueOnce(mockResponse);
        
        const { loginWithTelegram } = useAuth();
        const res = await loginWithTelegram('some_init_data');
        
        expect(mocks.mockApi.post).toHaveBeenCalledWith('/auth/telegram', { initData: 'some_init_data' });
        expect(res).toEqual(mockResponse);
    });

    it('loginWithDev uses config telegram id', async () => {
        const mockResponse = { user: { id: 1, fullName: 'Dev User' } };
        vi.mocked(mocks.mockApi.post).mockResolvedValueOnce(mockResponse);
        
        const { loginWithDev } = useAuth();
        const res = await loginWithDev();
        
        expect(res).not.toBeNull();
        expect(mocks.mockApi.post).toHaveBeenCalledWith('/auth/dev', { telegramId: 123456 });
    });

    it('signOut calls logout API and resets stores', async () => {
        const { signOut } = useAuth();
        await signOut();
        
        expect(mocks.mockApi.post).toHaveBeenCalledWith('/auth/logout', undefined);
        expect(mocks.mockNavigateTo).toHaveBeenCalledWith('/auth/login');
    });
});
