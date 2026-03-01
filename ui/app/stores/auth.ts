import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { User } from '~/types/user';

/**
 * Auth store using Dumb Store pattern.
 * Logic is moved to useAuth.ts composable.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isInitialized = ref(false);

  const isLoggedIn = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.isAdmin === true);
  const isSuperAdmin = computed(() => user.value?.isSuperAdmin === true);
  
  const displayName = computed(() => {
    if (user.value?.fullName) return user.value.fullName;
    if (user.value?.telegramUsername) return user.value.telegramUsername;
    return 'User';
  });

  function setUser(newUser: User | null) {
    user.value = newUser;
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function setInitialized(initialized: boolean) {
    isInitialized.value = initialized;
  }

  function reset() {
    user.value = null;
    isLoading.value = false;
    error.value = null;
    // We don't necessarily reset isInitialized unless we want to trigger full app reload
  }

  return {
    user,
    isLoading,
    isInitialized,
    error,
    isLoggedIn,
    isAdmin,
    isSuperAdmin,
    displayName,
    setUser,
    setLoading,
    setError,
    setInitialized,
    reset,
  };
});
