import { ref } from 'vue';
import type { Ref } from 'vue';
import { useSocialPosting } from '~/composables/useSocialPosting';

export function usePostPublish(options: {
  post: Ref<any>;
  selectedChannel: Ref<any>;
  publication: Ref<any>;
  emit: (e: 'success') => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { publishPost, isPublishing } = useSocialPosting();

  const isRepublishModalOpen = ref(false);
  const isArchiveWarningModalOpen = ref(false);
  const archiveWarningMessage = ref('');

  async function executePublish() {
    if (!options.post.value) return;

    try {
      const result = await publishPost(options.post.value.id);

      if (result.success) {
        toast.add({
          title: t('common.success'),
          description: t('publication.publishSuccess'),
          color: 'success',
        });
      } else {
        let errorMsg = result.message || t('publication.publishError');
        if (result.data?.results?.[0]?.error) {
          errorMsg = result.data.results[0].error;
        }

        toast.add({
          title: t('common.error'),
          description: errorMsg,
          color: 'error',
        });
      }

      options.emit('success');
    } catch (error: any) {
      toast.add({
        title: t('common.error'),
        description: t('publication.publishError'),
        color: 'error',
      });
      options.emit('success');
    }
  }

  async function handlePublishPost() {
    if (!options.post.value) return;

    let warning = '';
    const channel = options.selectedChannel.value;

    if (options.publication.value?.archivedAt) {
      warning = t('publication.archiveWarning.publication');
    } else if (channel?.archivedAt) {
      warning = t('publication.archiveWarning.channel', { name: channel.name });
    } else if (channel?.project?.archivedAt) {
      warning = t('publication.archiveWarning.project', { name: channel.project.name });
    } else if (channel?.isActive === false) {
      warning = t('publication.archiveWarning.inactiveChannel', { name: channel.name });
    }

    if (warning) {
      archiveWarningMessage.value = warning;
      isArchiveWarningModalOpen.value = true;
      return;
    }

    if (options.post.value.status === 'PUBLISHED' || options.post.value.status === 'FAILED') {
      isRepublishModalOpen.value = true;
      return;
    }

    await executePublish();
  }

  async function handleConfirmArchivePublish() {
    isArchiveWarningModalOpen.value = false;

    if (options.post.value?.status === 'PUBLISHED' || options.post.value?.status === 'FAILED') {
      isRepublishModalOpen.value = true;
      return;
    }

    await executePublish();
  }

  async function handleConfirmRepublish() {
    isRepublishModalOpen.value = false;
    await executePublish();
  }

  return {
    isPublishing,
    isRepublishModalOpen,
    isArchiveWarningModalOpen,
    archiveWarningMessage,
    handlePublishPost,
    handleConfirmArchivePublish,
    handleConfirmRepublish,
  };
}
