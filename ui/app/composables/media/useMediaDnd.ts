import { ref } from 'vue';
import type { Ref } from 'vue';
import type { MediaItem, MediaLinkItem } from '~/types/media';

interface UseMediaDndOptions {
  localMedia: Ref<MediaLinkItem[]>;
  props: {
    publicationId?: string;
    media: MediaLinkItem[];
    onReorder?: (reorderData: Array<{ id: string; order: number }>) => Promise<void>;
  };
  reorderMediaInPublication: (publicationId: string, data: any) => Promise<void>;
  normalizeMediaLinks: (items: MediaLinkItem[]) => MediaLinkItem[];
  emit: (event: 'refresh') => void;
  toast: any;
  t: (key: string, fallback?: string) => string;
  getMediaFileUrl: (id: string, variant?: string, updatedAt?: string, download?: boolean) => string;
  showExtendedOptions: Ref<boolean>;
  stagedFiles: Ref<File[]>;
  getDefaultOptimizationParams: () => any;
  uploadFiles: (files: FileList | File[], options?: any) => Promise<void>;
}

export function useMediaDnd(options: UseMediaDndOptions) {
  const {
    localMedia,
    props,
    reorderMediaInPublication,
    normalizeMediaLinks,
    emit,
    toast,
    t,
    getMediaFileUrl,
    showExtendedOptions,
    stagedFiles,
    getDefaultOptimizationParams,
    uploadFiles,
  } = options;

  const isDragging = ref(false);
  const isDropZoneActive = ref(false);

  async function handleDragEnd() {
    isDragging.value = false;

    // Prepare the reorder data
    const reorderData = localMedia.value
      .filter(item => item.id)
      .map((item, index) => ({ id: item.id!, order: index }));

    // Keep local order fields consistent with array order.
    for (let i = 0; i < localMedia.value.length; i += 1) {
      const item = localMedia.value[i];
      if (item) {
        item.order = i;
      }
    }

    try {
      if (props.publicationId) {
        await reorderMediaInPublication(props.publicationId, reorderData);
      } else if (props.onReorder) {
        await props.onReorder(reorderData);
      }

      // Emit event to refresh publication data
      emit('refresh');
    } catch (error: any) {
      toast.add({
        title: t('common.error'),
        description: t('media.reorderError', 'Failed to reorder media'),
        color: 'error',
      });
      
      // Revert to original order on error
      localMedia.value = normalizeMediaLinks(props.media);
    }
  }

  function handleDragStart() {
    isDragging.value = true;
  }

  function handleNativeDragStart(event: DragEvent, media?: MediaItem) {
    if (!media) return;
    try {
      const url = getMediaFileUrl(media.id, undefined, media.updatedAt, true);
      const absoluteUrl = new URL(url, window.location.origin).href;
      const mime = media.mimeType || 'application/octet-stream';
      const filename = media.filename || 'file';

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'copy';
      }
      // Chrome/Edge on Windows and Mac
      event.dataTransfer?.setData('DownloadURL', `${mime}:${filename}:${absoluteUrl}`);
      
      // Linux/KDE fallback (often creates a shortcut or prompts to download)
      event.dataTransfer?.setData('text/uri-list', `${absoluteUrl}\r\n`);
      event.dataTransfer?.setData('text/plain', absoluteUrl);
    } catch (error) {
      console.error('Failed to set drag data', error);
    }
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDropZoneActive.value = true;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDropZoneActive.value = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDropZoneActive.value = false;
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDropZoneActive.value = false;

    const files = event.dataTransfer?.files;
    if (files) {
      if (showExtendedOptions.value) {
        stagedFiles.value.push(...Array.from(files));
      } else {
        const defaults = getDefaultOptimizationParams();
        await uploadFiles(files, defaults.enabled ? defaults : undefined);
      }
    }
  }

  return {
    isDragging,
    isDropZoneActive,
    handleDragEnd,
    handleDragStart,
    handleNativeDragStart,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
