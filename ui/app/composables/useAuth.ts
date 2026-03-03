import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';
import type { User, AuthResponse } from '~/types/auth';
import type { ProjectWithRole } from '~/types/projects';

/**
 * Auth composable following Dumb Store pattern.
 * Contains logic for authentication, profile management, and roles.
 */
export function useAuth() {
  const config = useRuntimeConfig();
  const api = useApi();
  const { executeAction } = useApiAction();
  const store = useAuthStore();

  const { user, isLoggedIn, isInitialized, isLoading, isAdmin } = storeToRefs(store);

  /**
   * Computed properties for auth state and mode.
   */
  const isAuthenticated = computed(() => isLoggedIn.value);
  const isDevMode = computed(() => ['true', '1', 'yes', 'on'].includes(String(config.public.devMode)));
  
  const authMode = computed(() => {
    if (isDevMode.value) return 'dev';
    return 'miniApp';
  });

  /**
   * Initialize auth state by fetching current user.
   */
  async function initialize() {
    store.setLoading(true);
    const [, response] = await executeAction(
      async () => await api.get<User>('/auth/me'),
      {
        onError: () => {
          store.setUser(null);
        },
      }
    );

    if (response) {
      store.setUser(response);
    }
    store.setInitialized(true);
    store.setLoading(false);
    return response;
  }

  /**
   * Login with Telegram data.
   */
  async function loginWithTelegram(initData: string) {
    store.setLoading(true);
    const [, response] = await executeAction(async () => {
      const res = await api.post<AuthResponse>('/auth/telegram', { initData });
      return res;
    });

    if (response) {
      store.setUser(response.user);
      store.setInitialized(true);
    }
    store.setLoading(false);
    return response;
  }

  /**
   * Login with dev telegram ID (only in dev mode).
   */
  async function loginWithDev() {
    store.setLoading(true);
    const [, response] = await executeAction(async () => {
      const devTelegramId = config.public.devTelegramId;
      if (!isDevMode.value || !devTelegramId) {
        throw new Error('Dev mode is not enabled or dev telegram ID is not set');
      }

      return await api.post<AuthResponse>('/auth/dev', {
        telegramId: Number(devTelegramId),
      });
    });

    if (response) {
      store.setUser(response.user);
      store.setInitialized(true);
    }

    store.setLoading(false);
    return response;
  }

  /**
   * Sign out and clear all stores.
   */
  async function signOut() {
    await executeAction(async () => await api.post('/auth/logout', undefined));

    // Reset all stores
    store.reset();
    useAppStore().reset();
    useNotificationsStore().reset();
    useDashboardStore().reset();
    useUsersStore().reset();
    useProjectsStore().reset();
    useSttStore().reset();
    useChannelsStore().reset();
    usePublicationsStore().reset();
    usePostsStore().reset();
    useNewsStore().reset();
    useMediaStore().reset();
    useTemplatesStore().reset();
    useContentDestinationStore().reset();
    useAutosaveStore().reset();

    navigateTo('/auth/login');
  }

  /**
   * Checks if user has a specific role in a project.
   */
  function hasProjectRole(project: ProjectWithRole | null | undefined, roles: string | string[]) {
    if (!project?.role) return false;
    const rolesArray = Array.isArray(roles) ? roles : [roles];
    return rolesArray.includes(project.role);
  }

  /**
   * Checks if user is owner of a project.
   */
  function isProjectOwner(project: ProjectWithRole | null | undefined) {
    return project?.role === 'OWNER';
  }

  return {
    user,
    isLoggedIn, // kept for backward compatibility if any
    isAuthenticated,
    isAdmin,
    isInitialized,
    isLoading,
    authMode,
    initialize,
    loginWithTelegram,
    loginWithDev,
    signOut,
    hasProjectRole,
    isProjectOwner,
  };
}
