<template>
  <UApp>
    <NuxtRouteAnnouncer />
    
    <!-- Initial startup loader -->
    <Transition
      leave-active-class="transition-opacity duration-500"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <CommonAppLoading v-if="!authStore.isInitialized" />
    </Transition>

    <NuxtErrorBoundary>
      <NuxtLayout v-if="authStore.isInitialized">
        <NuxtPage :key="route.fullPath" />
      </NuxtLayout>
      
      <template #error="{ error, clearError }">
        <div class="fixed inset-0 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 z-9999">
          <CommonErrorState 
            :error="error" 
            :title="t('common.fatalAppError')"
            @retry="clearError"
          />
        </div>
      </template>
    </NuxtErrorBoundary>
  </UApp>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();
const route = useRoute();
const authStore = useAuthStore();
const { connectWebSocket, disconnectWebSocket } = useNotifications();

// Watch for login/logout to manage WebSocket connection
watch(() => authStore.isLoggedIn, (isLoggedIn) => {
  if (isLoggedIn) {
    connectWebSocket();
  } else {
    disconnectWebSocket();
  }
}, { immediate: true });

onBeforeUnmount(() => {
  disconnectWebSocket();
});
</script>

