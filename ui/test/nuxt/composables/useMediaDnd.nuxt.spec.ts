import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useMediaDnd } from '~/composables/media/useMediaDnd';

describe('useMediaDnd', () => {
  const mockLocalMedia = ref([
    { id: '1', order: 0 },
    { id: '2', order: 1 },
  ]);

  const mockProps = {
    publicationId: 'pub1',
    media: [
      { id: '1', order: 0 },
      { id: '2', order: 1 },
    ],
    onReorder: vi.fn(),
  };

  const reorderMediaInPublication = vi.fn();
  const normalizeMediaLinks = vi.fn((items) => items);
  const emit = vi.fn();
  const toast = { add: vi.fn() };
  const t = vi.fn((key) => key);
  const getMediaFileUrl = vi.fn(() => 'http://example.com/file');
  const showExtendedOptions = ref(false);
  const stagedFiles = ref<File[]>([]);
  const getDefaultOptimizationParams = vi.fn(() => ({ enabled: true }));
  const uploadFiles = vi.fn();

  const options = {
    localMedia: mockLocalMedia as any,
    props: mockProps as any,
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalMedia.value = [
      { id: '1', order: 0 },
      { id: '2', order: 1 },
    ];
  });

  it('handleDragEnd reorders media in publication', async () => {
    const { handleDragEnd } = useMediaDnd(options);
    
    // Simulate reorder in local storage (swap 1 and 2)
    mockLocalMedia.value = [
      { id: '2', order: 0 },
      { id: '1', order: 1 },
    ];

    await handleDragEnd();

    expect(reorderMediaInPublication).toHaveBeenCalledWith('pub1', [
      { id: '2', order: 0 },
      { id: '1', order: 1 },
    ]);
    expect(emit).toHaveBeenCalledWith('refresh');
  });

  it('handleDragEnd reverts on error', async () => {
    reorderMediaInPublication.mockRejectedValueOnce(new Error('Failed'));
    const { handleDragEnd } = useMediaDnd(options);
    
    mockLocalMedia.value = [
      { id: '2', order: 0 },
      { id: '1', order: 1 },
    ];

    await handleDragEnd();

    expect(toast.add).toHaveBeenCalled();
    // Should be reverted to props.media via normalizeMediaLinks
    expect(normalizeMediaLinks).toHaveBeenCalledWith(mockProps.media);
  });

  it('handleDrop adds files to stagedFiles when extended options is open', async () => {
    const { handleDrop } = useMediaDnd(options);
    showExtendedOptions.value = true;
    stagedFiles.value = [];

    const file = new File([''], 'test.png', { type: 'image/png' });
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        files: [file],
      },
    } as any;

    await handleDrop(event);

    expect(stagedFiles.value).toHaveLength(1);
    expect(stagedFiles.value[0]).toEqual(file);
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it('handleDrop uploads files directly when extended options is closed', async () => {
    const { handleDrop } = useMediaDnd(options);
    showExtendedOptions.value = false;
    
    const file = new File([''], 'test.png', { type: 'image/png' });
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        files: [file],
      },
    } as any;

    await handleDrop(event);

    expect(uploadFiles).toHaveBeenCalled();
  });
});
