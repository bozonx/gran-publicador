import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth';

export enum NotificationType {
  PUBLICATION_FAILED = 'PUBLICATION_FAILED',
  PROJECT_INVITE = 'PROJECT_INVITE',
  SYSTEM = 'SYSTEM',
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

  const items = ref<Notification[]>([]);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const socket = ref<Socket | null>(null);

  const hasUnread = computed(() => unreadCount.value > 0);

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
        items.value = [...items.value, ...response.items];
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
      const item = items.value.find((n) => n.id === id);
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
    try {
      await api.patch('/notifications/read-all');
      items.value.forEach((item) => {
        if (!item.readAt) {
          item.readAt = new Date().toISOString();
        }
      });
      unreadCount.value = 0;
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  function connectWebSocket() {
    if (socket.value?.connected) return;

    // Determine WS URL
    // If apiBase is http://localhost:8080/api/v1, wsUrl should be http://localhost:8080
    // If apiBase is /api/v1, it means same host
    const apiBase = config.public.apiBase || '';
    const wsUrl = apiBase.replace('/api/v1', '') || window.location.origin;

    socket.value = io(`${wsUrl}/notifications`, {
      auth: {
        token: authStore.token,
      },
      transports: ['websocket'],
    });

    socket.value.on('connect', () => {
      console.log('Connected to notifications WebSocket');
    });

    socket.value.on('notification', (notification: Notification) => {
      // Add to the beginning of the list
      items.value.unshift(notification);
      unreadCount.value++;
      
      // Optionally show a toast
      // useToast().add({ title: notification.title, description: notification.message });
    });

    socket.value.on('disconnect', () => {
      console.log('Disconnected from notifications WebSocket');
    });

    socket.value.on('connect_error', (error) => {
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
