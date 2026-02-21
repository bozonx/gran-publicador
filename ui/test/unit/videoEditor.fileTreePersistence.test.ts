import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useVideoEditorStore } from '../../app/stores/videoEditor';

describe('stores/videoEditor file tree persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  it('restores file tree expanded paths once on openProject', async () => {
    const store = useVideoEditorStore();

    store.projects = ['demo'];

    window.localStorage.setItem(
      'gran-video-editor:file-tree:demo',
      JSON.stringify({ expandedPaths: ['sources', 'sources/video'] }),
    );

    await store.openProject('demo');

    expect(Object.keys(store.fileTreeExpandedPaths)).toEqual(['sources', 'sources/video']);

    window.localStorage.setItem(
      'gran-video-editor:file-tree:demo',
      JSON.stringify({ expandedPaths: ['different'] }),
    );

    await store.openProject('demo');

    expect(Object.keys(store.fileTreeExpandedPaths)).toEqual(['sources', 'sources/video']);
  });

  it('persists expanded paths lazily (debounced) to localStorage', async () => {
    const store = useVideoEditorStore();

    store.projects = ['demo'];
    await store.openProject('demo');

    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem');

    store.setFileTreePathExpanded('sources', true);

    expect(setItemSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy.mock.calls[0]?.[0]).toBe('gran-video-editor:file-tree:demo');

    const stored = window.localStorage.getItem('gran-video-editor:file-tree:demo');
    expect(stored).toContain('sources');
  });
});
