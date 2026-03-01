import { ref, computed } from 'vue';
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
  ChannelsFilter,
} from '~/types/channels';
import { useI18n } from 'vue-i18n';
import {
  getChannelProblems as getLocalProblems,
  getChannelProblemLevel as getLocalLevel,
} from '~/utils/channels';
import { applyArchiveQueryFlags } from '~/utils/archive-query';

export type {
  Channel,
  ChannelWithProject,
  ChannelCreateInput,
  ChannelUpdateInput,
  ChannelsFilter,
};

export function useChannels() {
  const api = useApi();
  const { t } = useI18n();
  const { executeAction } = useApiAction();
  const { archiveEntity, restoreEntity } = useArchive();

  const channels = ref<ChannelWithProject[]>([]);
  const currentChannel = useState<ChannelWithProject | null>(
    'useChannels.currentChannel',
    () => null,
  );

  const totalCount = ref(0);
  const totalUnfilteredCount = ref(0);

  // Loading states
  const isLoading = ref(false); // Global legacy loading state
  const isFetchingList = ref(false);
  const isFetchingChannel = ref(false);
  const isSaving = ref(false);
  const isDeleting = ref(false);

  const error = ref<string | null>(null);

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
    options: { append?: boolean } = {},
  ): Promise<ChannelWithProject[]> {
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
        }>('/channels', { params });

        if (options.append) {
          channels.value = [...channels.value, ...response.items];
        } else {
          channels.value = response.items;
        }

        totalCount.value = response.meta.total;
        totalUnfilteredCount.value = response.meta.totalUnfiltered ?? response.meta.total;

        return response.items;
      },
      { loadingRef: isFetchingList, errorRef: error, silentErrors: true }
    );
    return result || [];
  }

  async function fetchArchivedChannels(projectId: string): Promise<ChannelWithProject[]> {
    const [, result] = await executeAction(
      async () => {
        const params: any = { projectId };
        return await api.get<ChannelWithProject[]>('/channels/archived', { params });
      },
      { loadingRef: isFetchingList, errorRef: error, silentErrors: true }
    );
    return result || [];
  }

  async function fetchChannel(channelId: string): Promise<ChannelWithProject | null> {
    const [, result] = await executeAction(
      async () => {
        const data = await api.get<ChannelWithProject>(`/channels/${channelId}`);
        currentChannel.value = data;
        return data;
      },
      { loadingRef: isFetchingChannel, errorRef: error, silentErrors: true }
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
      { loadingRef: isSaving, errorRef: error, successMessage: t('channel.createSuccess') }
    );
    return result;
  }

  async function updateChannel(
    channelId: string,
    data: ChannelUpdateInput,
  ): Promise<Channel | null> {
    const [, result] = await executeAction(
      async () => {
        return await api.patch<Channel>(`/channels/${channelId}`, data);
      },
      { loadingRef: isSaving, errorRef: error, successMessage: t('channel.updateSuccess') }
    );
    return result;
  }

  async function deleteChannel(channelId: string): Promise<boolean> {
    const [err] = await executeAction(
      async () => {
        await api.delete(`/channels/${channelId}`);
      },
      { loadingRef: isDeleting, errorRef: error, successMessage: t('channel.deleteSuccess') }
    );
    return !err;
  }

  async function archiveChannel(channelId: string): Promise<Channel | null> {
    const [, result] = await executeAction(
      async () => {
        await archiveEntity(ArchiveEntityType.CHANNEL, channelId);
        return await fetchChannel(channelId);
      },
      { loadingRef: isSaving, errorRef: error, silentErrors: true }
    );
    return result;
  }

  async function unarchiveChannel(channelId: string): Promise<Channel | null> {
    const [, result] = await executeAction(
      async () => {
        await restoreEntity(ArchiveEntityType.CHANNEL, channelId);
        return await fetchChannel(channelId);
      },
      { loadingRef: isSaving, errorRef: error, silentErrors: true }
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

    if (result) {
      // Update in list
      if (channel) {
        channel.isActive = result.isActive;
      }
      // Update current channel reference
      if (isCurrent && currentChannel.value) {
        currentChannel.value = { ...currentChannel.value, isActive: result.isActive };
      }
      return true;
    }
    return false;
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
    if (!channelObj) return false;
    return (
      channelObj.role === 'owner' || channelObj.role === 'admin' || channelObj.role === 'editor'
    );
  }

  function canDelete(channelObj: ChannelWithProject | null): boolean {
    if (!channelObj) return false;
    return channelObj.role === 'owner' || channelObj.role === 'admin';
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
    isLoading, // Legacy support
    isFetchingList,
    isFetchingChannel,
    isSaving,
    isDeleting,
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
