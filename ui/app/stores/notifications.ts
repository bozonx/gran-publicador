import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth';

export enum NotificationType {
  PUBLICATION_FAILED = 'PUBLICATION_FAILED',
  PROJECT_INVITE = 'PROJECT_INVITE',
  SYSTEM = 'SYSTEM',
  NEW_NEWS = 'NEW_NEWS',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  meta: any;
  readAt: string | null;
  createdAt: string;
}

export const useNotificationsStore = defineStore('notifications', () => {
  const authStore = useAuthStore();
  const api = useApi();
  const config = useRuntimeConfig();
  const toast = useToast();
  const { t } = useI18n();

  const items = ref<Notification[]>([]);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const socket = ref<Socket | null>(null);

  const hasUnread = computed(() => unreadCount.value > 0);

  // Maximum number of notifications to keep in memory to prevent memory leaks
  const MAX_ITEMS = 50;

  /**
   * Fetch notification history from REST API
   */
  async function fetchNotifications(limit = 20, offset = 0, append = false) {
    isLoading.value = true;
    try {
      const response = await api.get<{ items: Notification[]; total: number }>('/notifications', {
        params: { limit, offset },
      });
      if (append) {
        // Avoid duplicates when appending
        const existingIds = new Set(items.value.map(i => i.id));
        const newItems = response.items.filter(i => !existingIds.has(i.id));
        items.value = [...items.value, ...newItems].slice(0, MAX_ITEMS * 2); // Allow more for the full page
      } else {
        items.value = response.items;
      }
      await fetchUnreadCount();
      return response;
    } catch (error) {
      console.error('Failed to fetch notifications', error);
      return { items: [], total: 0 };
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Fetch unread count from REST API
   */
  async function fetchUnreadCount() {
    try {
      const response = await api.get<{ count: number }>('/notifications/unread-count');
      unreadCount.value = response.count;
    } catch (error) {
      console.error('Failed to fetch unread count', error);
    }
  }

  /**
   * Mark a notification as read
   */
  async function markAsRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      const item = items.value.find(n => n.id === id);
      if (item && !item.readAt) {
        item.readAt = new Date().toISOString();
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async function markAllAsRead() {
    const previousUnread = unreadCount.value;
    try {
      await api.patch('/notifications/read-all');
      items.value.forEach(item => {
        if (!item.readAt) {
          item.readAt = new Date().toISOString();
        }
      });
      unreadCount.value = 0;
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
      // Rollback if error (optional)
      // unreadCount.value = previousUnread;
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  function connectWebSocket() {
    if (socket.value) return;

    // Determine WS URL
    const apiBase = config.public.apiBase || '';
    let wsUrl = '';

    if (apiBase.startsWith('http')) {
      // Full URL: http://localhost:8080/api/v1 -> http://localhost:8080
      const url = new URL(apiBase);
      wsUrl = url.origin;
    } else {
      // Relative URL or same origin
      wsUrl = window.location.origin;
    }

    socket.value = io(`${wsUrl}/notifications`, {
      auth: {
        token: authStore.accessToken,
      },
      transports: ['websocket'],
    });

    socket.value.on('connect', () => {});

    socket.value.on('notification', (notification: Notification) => {
      // Check for duplicates
      if (items.value.some(n => n.id === notification.id)) return;

      // Add to the beginning of the list
      items.value.unshift(notification);

      // Limit list size
      if (items.value.length > MAX_ITEMS) {
        items.value = items.value.slice(0, MAX_ITEMS);
      }

      unreadCount.value++;

      const description = formatToastDescription(notification);

      // Show a toast
      toast.add({
        title: notification.title,
        description,
        icon: getNotificationIcon(notification.type),
        color: notification.type === NotificationType.PUBLICATION_FAILED ? 'error' : 'primary',
      });
    });

    socket.value.on('disconnect', () => {});

    socket.value.on('connect_error', error => {
      console.error('WebSocket connection error', error);
    });
  }

  /**
   * Disconnect from WebSocket
   */
  function disconnectWebSocket() {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
  }

  function getNotificationIcon(type: NotificationType) {
    switch (type) {
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
  }

  function formatToastDescription(notification: Notification): string {
    const raw = (notification.message || '').toString();

    // Avoid multiline/huge technical messages.
    const singleLine = raw.replace(/[\r\n]+/g, ' ').trim();
    const maxLen = 220;
    const normalized = singleLine.length > maxLen ? `${singleLine.slice(0, maxLen)}…` : singleLine;

    if (notification.type === NotificationType.PUBLICATION_FAILED) {
      return normalized || t('publication.publishError');
    }

    return normalized;
  }

  return {
    items,
    unreadCount,
    isLoading,
    hasUnread,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    connectWebSocket,
    disconnectWebSocket,
  };
});
