<script setup lang="ts">
import { useNotificationsStore } from '~/stores/notifications';

const notificationsStore = useNotificationsStore();
const isOpen = ref(false);

onMounted(async () => {
  await notificationsStore.fetchUnreadCount();
});

async function handleOpenChange(val: boolean) {
  if (val) {
    const route = useRoute();
    // Don't re-fetch if we're on the dedicated notifications page as it has its own logic
    // or if we already have items and unread count is zero.
    if (route.path === '/notifications' || (notificationsStore.items.length > 0 && notificationsStore.unreadCount === 0)) {
      return;
    }
    await notificationsStore.fetchNotifications();
  }
}
</script>

<template>
  <UPopover v-model:open="isOpen" :popper="{ placement: 'bottom-end', offsetDistance: 12 }" @update:open="handleOpenChange">
    <UButton
      variant="ghost"
      circular
      class="relative"
      :color="notificationsStore.unreadCount > 0 ? 'primary' : 'neutral'"
    >
      <UIcon name="i-heroicons-bell" class="w-5 h-5" />
      <span
        v-if="notificationsStore.unreadCount > 0"
        class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-white dark:border-gray-900"
      >
        {{ notificationsStore.unreadCount > 99 ? '99+' : notificationsStore.unreadCount }}
      </span>
    </UButton>

    <template #content>
      <CommonNotificationsNotificationPanel @close="isOpen = false" />
    </template>
  </UPopover>
</template>
