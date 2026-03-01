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
import { useNotificationsStore } from '~/stores/notifications';

const route = useRoute();
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();

// Watch for login/logout to manage WebSocket connection
watch(() => authStore.isLoggedIn, (isLoggedIn) => {
  if (isLoggedIn) {
    notificationsStore.connectWebSocket();
  } else {
    notificationsStore.disconnectWebSocket();
  }
}, { immediate: true });

onBeforeUnmount(() => {
  notificationsStore.disconnectWebSocket();
});
</script>

