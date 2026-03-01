import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Socket } from 'socket.io-client';
import type { Notification, NotificationType } from '~/types/notifications';

/**
 * Notifications store using Dumb Store pattern.
 * Logic is moved to useNotifications.ts composable.
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<Notification[]>([]);
  const unreadCount = ref(0);
  const totalCount = ref(0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const socket = ref<Socket | null>(null);

  const hasUnread = computed(() => unreadCount.value > 0);

  // Maximum number of notifications to keep in memory to prevent memory leaks
  const MAX_ITEMS = 50;

  function setItems(newItems: Notification[]) {
    items.value = newItems;
  }

  function appendItems(newItems: Notification[]) {
    // Avoid duplicates
    const existingIds = new Set(items.value.map(i => i.id));
    const uniqueNewItems = newItems.filter(i => !existingIds.has(i.id));
    items.value = [...items.value, ...uniqueNewItems].slice(0, MAX_ITEMS * 2);
  }

  function unshiftItem(item: Notification) {
    // Check for duplicates
    if (items.value.some(n => n.id === item.id)) return;
    items.value.unshift(item);
    if (items.value.length > MAX_ITEMS) {
      items.value = items.value.slice(0, MAX_ITEMS);
    }
  }

  function setUnreadCount(count: number) {
    unreadCount.value = count;
  }

  function incrementUnread() {
    unreadCount.value++;
  }

  function decrementUnread() {
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  }

  function setTotalCount(count: number) {
    totalCount.value = count;
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function setSocket(newSocket: Socket | null) {
    socket.value = newSocket;
  }

  function markReadLocally(id: string) {
    const item = items.value.find(n => n.id === id);
    if (item && !item.readAt) {
      item.readAt = new Date().toISOString();
      decrementUnread();
    }
  }

  function markAllReadLocally() {
    items.value.forEach(item => {
      if (!item.readAt) {
        item.readAt = new Date().toISOString();
      }
    });
    unreadCount.value = 0;
  }

  function reset() {
    items.value = [];
    unreadCount.value = 0;
    totalCount.value = 0;
    isLoading.value = false;
    error.value = null;
    // socket shouldn't be reset here, or maybe it should if we want to force reconnection?
  }

  return {
    items,
    unreadCount,
    totalCount,
    isLoading,
    error,
    socket,
    hasUnread,
    setItems,
    appendItems,
    unshiftItem,
    setUnreadCount,
    incrementUnread,
    decrementUnread,
    setTotalCount,
    setLoading,
    setError,
    setSocket,
    markReadLocally,
    markAllReadLocally,
    reset,
  };
});
