<script setup lang="ts">
import { type Notification, NotificationType, useNotificationsStore } from '~/stores/notifications';

const props = defineProps<{
  notification: Notification;
}>();

const emit = defineEmits(['click']);

const { locale, t } = useI18n();
const notificationsStore = useNotificationsStore();
const router = useRouter();

const relativeTime = useTimeAgo(new Date(props.notification.createdAt));

const target = ref<HTMLDivElement | null>(null);
let timeoutId: ReturnType<typeof setTimeout> | null = null;

const { stop } = useIntersectionObserver(
  target,
  (entries) => {
    const entry = entries[0];
    if (entry?.isIntersecting && !props.notification.readAt) {
      if (!timeoutId) {
        timeoutId = setTimeout(async () => {
          if (!props.notification.readAt) {
            await notificationsStore.markAsRead(props.notification.id);
          }
          stop();
        }, 2000);
      }
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  },
  { threshold: 0.5 }
);

onUnmounted(() => {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  stop();
});

const icon = computed(() => {
  switch (props.notification.type) {
    case NotificationType.PUBLICATION_FAILED:
      return 'i-heroicons-exclamation-circle';
    case NotificationType.PROJECT_INVITE:
      return 'i-heroicons-user-plus';
    case NotificationType.SYSTEM:
      return 'i-heroicons-information-circle';
    case NotificationType.NEW_NEWS:
      return 'i-heroicons-newspaper';
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
    case NotificationType.NEW_NEWS:
      return 'text-green-500';
    default:
      return 'text-gray-400';
  }
});

async function handleClick() {
  if (!props.notification.readAt) {
    await notificationsStore.markAsRead(props.notification.id);
  }
  
  // Navigation logic
  const meta = props.notification.meta || {};
  if (props.notification.type === NotificationType.PUBLICATION_FAILED && meta.publicationId) {
    router.push(`/publications/${meta.publicationId}`);
  } else if (props.notification.type === NotificationType.PROJECT_INVITE && meta.projectId) {
    router.push(`/projects/${meta.projectId}`);
  } else if (props.notification.type === NotificationType.NEW_NEWS && meta.projectId) {
    router.push(`/projects/${meta.projectId}/news`);
  }
  
  emit('click', props.notification);
}
</script>

<template>
  <div
    ref="target"
    class="p-4 border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
    :class="{ 
      'bg-blue-50/50 dark:bg-blue-900/10': !notification.readAt,
      'hover:bg-blue-100/30 dark:hover:bg-blue-800/20': !notification.readAt 
    }"
    @click="handleClick"
  >
    <div class="flex items-start gap-3">
      <div class="mt-1">
        <UIcon :name="icon" :class="['w-5 h-5', iconColor]" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold truncate">{{ notification.title }}</p>
          <div v-if="!notification.readAt" class="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
        </div>
        <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5 whitespace-pre-line leading-relaxed">
          {{ notification.message }}
        </p>
        <div class="flex items-center justify-between mt-2">
          <p class="text-[10px] text-gray-400 uppercase tracking-wider">
            {{ relativeTime }}
          </p>
          <p v-if="notification.meta?.publicationId || notification.meta?.projectId" class="text-[10px] text-blue-500 font-medium hover:underline">
            {{ 
              notification.type === NotificationType.PUBLICATION_FAILED ? t('notifications.view_publication') : 
              notification.type === NotificationType.NEW_NEWS ? t('notifications.view_news') :
              t('notifications.view_project') 
            }} &rarr;
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
