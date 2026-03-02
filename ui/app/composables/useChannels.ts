import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useChannelsStore } from '~/stores/channels';
import { eventBus } from '~/utils/events';
import { ArchiveEntityType } from '~/types/archive.types';
import {
  getSocialMediaColor as getColorBase,
  getSocialMediaIcon as getIconBase,
  getSocialMediaOptions,
} from '~/utils/socialMedia';
import type { SocialMedia } from '~/types/socialMedia';
import type {
  Channel,
  ChannelWithProject,
  ChannelCreateInput,
  ChannelUpdateInput,
} from '~/types/channels';
import {
  getChannelProblems as getLocalProblems,
  getChannelProblemLevel as getLocalLevel,
  canEditChannel,
  canDeleteChannel,
} from '~/utils/channels';
import { applyArchiveQueryFlags } from '~/utils/archive-query';

export function useChannels() {
  const api = useApi();
  const { t } = useI18n();
  const { executeAction } = useApiAction();
  const { archiveEntity, restoreEntity } = useArchive();

  const store = useChannelsStore();
  const {
    items: channels,
    currentChannel,
    totalCount,
    totalUnfilteredCount,
    isLoading,
    error,
  } = storeToRefs(store);

  // Helper bindings for store state
  const loadingBinding = computed({
    get: () => isLoading.value,
    set: val => store.setLoading(val),
  });
  const errorBinding = computed({
    get: () => error.value,
    set: val => store.setError(val),
  });

  const channelsController = ref<AbortController | null>(null);

  const socialMediaOptions = computed(() => getSocialMediaOptions(t));

  /**
   * Fetch channels with server-side pagination, filtering, and sorting
   */
  async function fetchChannels(
    filters?: {
      projectId?: string;
      search?: string;
      ownership?: 'all' | 'own' | 'guest';
      issueType?: 'all' | 'noCredentials' | 'failedPosts' | 'stale' | 'inactive' | 'problematic';
      socialMedia?: string;
      language?: string;
      sortBy?: 'alphabetical' | 'socialMedia' | 'language' | 'postsCount';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
      includeArchived?: boolean;
      archivedOnly?: boolean;
    },
    options: { append?: boolean; signal?: AbortSignal } = {},
  ): Promise<ChannelWithProject[]> {
    if (!options.append && !options.signal) {
      channelsController.value?.abort();
      channelsController.value = api.createAbortController();
    }

    const [, result] = await executeAction(
      async () => {
        const params: Record<string, string | number | boolean | undefined> = { ...filters };

        applyArchiveQueryFlags(params, {
          includeArchived: filters?.includeArchived,
          archivedOnly: filters?.archivedOnly,
        });

        const response = await api.get<{
          items: ChannelWithProject[];
          meta: { total: number; limit: number; offset: number; totalUnfiltered?: number };
        }>('/channels', {
          params,
          signal: options.signal || (options.append ? undefined : channelsController.value?.signal),
        });

        if (options.append) {
          store.setItems([...channels.value, ...response.items]);
        } else {
          store.setItems(response.items);
        }

        store.setTotalCount(response.meta.total);
        store.setTotalUnfilteredCount(response.meta.totalUnfiltered ?? response.meta.total);

        return response.items;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: false },
    );
    return result || [];
  }

  async function fetchArchivedChannels(projectId: string): Promise<ChannelWithProject[]> {
    const [, result] = await executeAction(
      async () => {
        const params: any = { projectId };
        return await api.get<ChannelWithProject[]>('/channels/archived', { params });
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: false },
    );
    return result || [];
  }

  async function fetchChannel(channelId: string): Promise<ChannelWithProject | null> {
    const [, result] = await executeAction(
      async () => {
        const data = await api.get<ChannelWithProject>(`/channels/${channelId}`);
        store.setCurrentChannel(data);
        return data;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true },
    );
    return result;
  }

  async function createChannel(data: ChannelCreateInput): Promise<Channel | null> {
    const [, result] = await executeAction(
      async () => {
        const channel = await api.post<Channel>('/channels', data);
        if (data.projectId) {
          await fetchChannels({ projectId: data.projectId });
        }
        eventBus.emit('channel:created', channel);
        return channel;
      },
      {
        loadingRef: loadingBinding,
        errorRef: errorBinding,
        successMessage: t('channel.createSuccess'),
      },
    );
    return result;
  }

  async function updateChannel(
    channelId: string,
    data: ChannelUpdateInput,
  ): Promise<Channel | null> {
    const [, result] = await executeAction(
      async () => {
        const updated = await api.patch<Channel>(`/channels/${channelId}`, data);
        store.updateChannelInList(channelId, updated as Partial<ChannelWithProject>);
        return updated;
      },
      {
        loadingRef: loadingBinding,
        errorRef: errorBinding,
        successMessage: t('channel.updateSuccess'),
      },
    );
    return result;
  }

  async function deleteChannel(channelId: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.delete(`/channels/${channelId}`);
        store.setItems(channels.value.filter(c => c.id !== channelId));
      },
      {
        loadingRef: loadingBinding,
        errorRef: errorBinding,
        successMessage: t('channel.deleteSuccess'),
      },
    );
    return !err;
  }

  async function archiveChannel(channelId: string): Promise<Channel | null> {
    const [, result] = await executeAction(
      async () => {
        await archiveEntity(ArchiveEntityType.CHANNEL, channelId);
        return await fetchChannel(channelId);
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true },
    );
    return result;
  }

  async function unarchiveChannel(channelId: string): Promise<Channel | null> {
    const [, result] = await executeAction(
      async () => {
        await restoreEntity(ArchiveEntityType.CHANNEL, channelId);
        return await fetchChannel(channelId);
      },
      { loadingRef: loadingBinding, errorRef: errorBinding, silentErrors: true },
    );
    return result;
  }

  async function toggleChannelActive(channelId: string): Promise<boolean> {
    const channel = channels.value.find(c => c.id === channelId);
    const isCurrent = currentChannel.value?.id === channelId;

    if (!channel && !isCurrent) return false;

    const currentIsActive = isCurrent ? currentChannel.value?.isActive : channel?.isActive;
    const newValue = !currentIsActive;

    const result = await updateChannel(channelId, { isActive: newValue });
    return !!result;
  }

  function getSocialMediaColor(socialMedia: SocialMedia): string {
    return getColorBase(socialMedia);
  }

  function getSocialMediaIcon(socialMedia: SocialMedia): string {
    return getIconBase(socialMedia);
  }

  function getSocialMediaDisplayName(socialMedia: SocialMedia): string {
    return t(`socialMedia.${socialMedia.toLowerCase()}`);
  }

  function canEdit(channelObj: ChannelWithProject | null): boolean {
    return canEditChannel(channelObj);
  }

  function canDelete(channelObj: ChannelWithProject | null): boolean {
    return canDeleteChannel(channelObj);
  }

  /**
   * Get channel problems, prioritizing server-side calculation.
   */
  function getChannelProblems(channelObj: ChannelWithProject | null) {
    if (!channelObj) return [];
    if (channelObj.problems) return channelObj.problems;
    return getLocalProblems(channelObj);
  }

  /**
   * Get channel problem level, prioritizing server-side calculation.
   */
  function getChannelProblemLevel(
    channelObj: ChannelWithProject | null,
  ): 'critical' | 'warning' | null {
    if (!channelObj) return null;
    if (channelObj.problems) {
      if (channelObj.problems.some(p => p.type === 'critical')) return 'critical';
      if (channelObj.problems.some(p => p.type === 'warning')) return 'warning';
      return null;
    }
    return getLocalLevel(channelObj);
  }

  return {
    channels,
    currentChannel,
    totalCount,
    totalUnfilteredCount,
    isLoading,
    error,
    socialMediaOptions,
    fetchChannels,
    fetchArchivedChannels,
    fetchChannel,
    createChannel,
    updateChannel,
    deleteChannel,
    archiveChannel,
    unarchiveChannel,
    toggleChannelActive,
    canEdit,
    canDelete,
    getSocialMediaDisplayName,
    getSocialMediaIcon,
    getSocialMediaColor,
    // Problem detection
    getChannelProblems,
    getChannelProblemLevel,
  };
}
