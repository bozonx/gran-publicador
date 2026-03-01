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

    <NuxtLayout v-if="authStore.isInitialized">
      <NuxtPage :key="route.fullPath" />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

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

