<script setup lang="ts">
import { type Notification, NotificationType, useNotificationsStore } from '~/stores/notifications';

const props = defineProps<{
  notification: Notification;
}>();

const emit = defineEmits(['click']);

const { locale } = useI18n();
const notificationsStore = useNotificationsStore();

const relativeTime = useTimeAgo(new Date(props.notification.createdAt));

const icon = computed(() => {
  switch (props.notification.type) {
    case NotificationType.PUBLICATION_FAILED:
      return 'i-heroicons-exclamation-circle';
    case NotificationType.PROJECT_INVITE:
      return 'i-heroicons-user-plus';
    case NotificationType.SYSTEM:
      return 'i-heroicons-information-circle';
    default:
      return 'i-heroicons-bell';
  }
});

const iconColor = computed(() => {
  switch (props.notification.type) {
    case NotificationType.PUBLICATION_FAILED:
      return 'text-red-500';
    case NotificationType.PROJECT_INVITE:
      return 'text-blue-500';
    case NotificationType.SYSTEM:
      return 'text-gray-500';
    default:
      return 'text-gray-400';
  }
});

async function handleClick() {
  if (!props.notification.readAt) {
    await notificationsStore.markAsRead(props.notification.id);
  }
  emit('click', props.notification);
}
</script>

<template>
  <div
    class="p-4 border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
    :class="{ 'bg-blue-50/50 dark:bg-blue-900/10': !notification.readAt }"
    @click="handleClick"
  >
    <div class="flex items-start gap-3">
      <div class="mt-1">
        <UIcon :name="icon" :class="['w-5 h-5', iconColor]" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold truncate">{{ notification.title }}</p>
          <div v-if="!notification.readAt" class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
        </div>
        <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5 whitespace-pre-line">
          {{ notification.message }}
        </p>
        <p class="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">
          {{ relativeTime }}
        </p>
      </div>
    </div>
  </div>
</template>
