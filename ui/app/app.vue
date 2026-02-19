<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage :key="route.path" />
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
