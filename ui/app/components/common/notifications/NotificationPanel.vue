<script setup lang="ts">
import { useNotificationsStore } from '~/stores/notifications';

const notificationsStore = useNotificationsStore();
const { t } = useI18n();

const emit = defineEmits(['close']);

const recentNotifications = computed(() => notificationsStore.items.slice(0, 5));

async function markAllAsRead() {
  await notificationsStore.markAllAsRead();
}

function handleNotificationClick() {
  // Optionally close panel or navigate
  // emit('close');
}
</script>

<template>
  <div class="flex flex-col w-80 sm:w-96 bg-white dark:bg-gray-900 shadow-xl rounded-lg border dark:border-gray-800">
    <!-- Header -->
    <div class="p-4 border-b dark:border-gray-800 flex items-center justify-between">
      <h3 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">
        {{ t('notifications.title') }}
      </h3>
      <UButton
        v-if="notificationsStore.unreadCount > 0"
        variant="ghost"
        size="xs"
        class="text-blue-500 hover:text-blue-600"
        @click="markAllAsRead"
      >
        {{ t('notifications.markAllRead') }}
      </UButton>
    </div>

    <!-- Content -->
    <div class="flex-1 min-h-0">
      <div v-if="recentNotifications.length > 0">
        <CommonNotificationsNotificationItem
          v-for="item in recentNotifications"
          :key="item.id"
          :notification="item"
          @click="handleNotificationClick"
        />
      </div>
      <div v-else-if="notificationsStore.isLoading" class="p-8 flex flex-col items-center justify-center text-gray-500">
        <UiLoadingSpinner size="md" :label="t('common.loading')" centered />
      </div>
      <div v-else class="p-12 flex flex-col items-center justify-center text-center">
        <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <UIcon name="i-heroicons-bell-slash" class="w-8 h-8 text-gray-400" />
        </div>
        <p class="text-sm text-gray-500 font-medium">{{ t('notifications.empty') }}</p>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="p-3 border-t dark:border-gray-800 text-center">
      <UButton variant="ghost" size="sm" class="text-gray-500 w-full" to="/notifications" @click="$emit('close')">
        {{ t('notifications.viewAll') }}
      </UButton>
    </div>
  </div>
</template>
