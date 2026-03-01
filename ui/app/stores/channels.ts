import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { ChannelWithProject } from '~/types/channels';

/**
 * Channels store using Dumb Store pattern.
 * Logic is moved to useChannels.ts composable.
 */
export const useChannelsStore = defineStore('channels', () => {
  const items = ref<ChannelWithProject[]>([]);
  const currentChannel = ref<ChannelWithProject | null>(null);
  const totalCount = ref(0);
  const totalUnfilteredCount = ref(0);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  function setItems(newItems: ChannelWithProject[]) {
    items.value = newItems;
  }

  function setCurrentChannel(channel: ChannelWithProject | null) {
    currentChannel.value = channel;
  }

  function setTotalCount(count: number) {
    totalCount.value = count;
  }

  function setTotalUnfilteredCount(count: number) {
    totalUnfilteredCount.value = count;
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  function setError(err: string | null) {
    error.value = err;
  }

  function updateChannelInList(id: string, updates: Partial<ChannelWithProject>) {
    const index = items.value.findIndex(c => c.id === id);
    if (index !== -1) {
      items.value[index] = { ...items.value[index], ...updates };
    }
    if (currentChannel.value?.id === id) {
      currentChannel.value = { ...currentChannel.value, ...updates };
    }
  }

  function reset() {
    items.value = [];
    currentChannel.value = null;
    totalCount.value = 0;
    totalUnfilteredCount.value = 0;
    isLoading.value = false;
    error.value = null;
  }

  return {
    items,
    currentChannel,
    totalCount,
    totalUnfilteredCount,
    isLoading,
    error,
    setItems,
    setCurrentChannel,
    setTotalCount,
    setTotalUnfilteredCount,
    setLoading,
    setError,
    updateChannelInList,
    reset,
  };
});
