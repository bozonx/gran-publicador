import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { io } from 'socket.io-client';
import { useNotificationsStore } from '~/stores/notifications';
import { logger } from '~/utils/logger';
import { DEFAULT_PAGE_SIZE } from '~/constants';
import { NotificationType } from '~/types/notifications';
import type { Notification } from '~/types/notifications';

export const useNotifications = () => {
  const store = useNotificationsStore();
  const { items, unreadCount, totalCount, isLoading, error, socket, hasUnread } =
    storeToRefs(store);
  const api = useApi();
  const { executeAction } = useApiAction();
  const config = useRuntimeConfig();
  const toast = useToast();
  const { t } = useI18n();

  // Helper bindings for store state
  const loadingBinding = computed({
    get: () => isLoading.value,
    set: val => store.setLoading(val),
  });
  const errorBinding = computed({
    get: () => error.value,
    set: val => store.setError(val),
  });

  async function fetchNotifications(limit = DEFAULT_PAGE_SIZE, offset = 0, append = false) {
    const [, response] = await executeAction(
      async () => {
        const data = await api.get<{ items: Notification[]; total: number }>('/notifications', {
          params: { limit, offset },
        });

        if (append) {
          store.appendItems(data.items);
        } else {
          store.setItems(data.items);
        }

        store.setTotalCount(data.total);
        await fetchUnreadCount();
        return data;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: false },
    );
    return response || { items: [], total: 0 };
  }

  async function fetchUnreadCount() {
    try {
      const response = await api.get<{ count: number }>('/notifications/unread-count');
      store.setUnreadCount(response.count);
    } catch (err: any) {
      logger.error('Failed to fetch unread count', err);
    }
  }

  async function markAsRead(id: string) {
    const [err] = await executeAction(
      async () => {
        await api.patch(`/notifications/${id}/read`);
        store.markReadLocally(id);
      },
      { silentErrors: true },
    );
    return !err;
  }

  async function markAllAsRead() {
    const [err] = await executeAction(
      async () => {
        await api.patch('/notifications/read-all');
        store.markAllReadLocally();
      },
      { silentErrors: true },
    );
    return !err;
  }

  function connectWebSocket() {
    if (socket.value) return;

    const apiBase = config.public.apiBase || '';
    let wsUrl = '';

    if (apiBase.startsWith('http')) {
      const url = new URL(apiBase);
      wsUrl = url.origin;
    } else {
      wsUrl = window.location.origin;
    }

    const newSocket = io(`${wsUrl}/notifications`, {
      withCredentials: true,
      transports: ['websocket'],
    });

    newSocket.on('notification', (notification: Notification) => {
      store.unshiftItem(notification);
      store.incrementUnread();

      const description = formatToastDescription(notification);

      toast.add({
        title: notification.title,
        description,
        icon: getNotificationIcon(notification.type),
        color: notification.type === NotificationType.PUBLICATION_FAILED ? 'error' : 'primary',
      });
    });

    newSocket.on('notification_read', (data: { id?: string; all: boolean }) => {
      if (data.all) {
        store.markAllReadLocally();
      } else if (data.id) {
        store.markReadLocally(data.id);
      }
    });

    newSocket.on('connect_error', (err: any) => {
      logger.error('WebSocket connection error', err);
    });

    store.setSocket(newSocket);
  }

  function disconnectWebSocket() {
    if (socket.value) {
      socket.value.disconnect();
      store.setSocket(null);
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
    totalCount,
    isLoading,
    error,
    hasUnread,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    connectWebSocket,
    disconnectWebSocket,
    getNotificationIcon,
  };
};
