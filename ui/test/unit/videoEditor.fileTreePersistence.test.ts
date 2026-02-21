import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useGranVideoEditorUiStore } from '../../app/stores/granVideoEditor/ui.store';

describe('stores/granVideoEditor ui file tree persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('restores file tree expanded paths once per project', async () => {
    const store = useGranVideoEditorUiStore();
    window.localStorage.setItem(
      'gran-video-editor:file-tree:demo',
      JSON.stringify({ expandedPaths: ['sources', 'sources/video'] }),
    );

    store.restoreFileTreeStateOnce('demo');

    expect(Object.keys(store.fileTreeExpandedPaths)).toEqual(['sources', 'sources/video']);

    window.localStorage.setItem(
      'gran-video-editor:file-tree:demo',
      JSON.stringify({ expandedPaths: ['different'] }),
    );

    store.restoreFileTreeStateOnce('demo');

    expect(Object.keys(store.fileTreeExpandedPaths)).toEqual(['sources', 'sources/video']);
  });

  it('persists expanded paths to localStorage', async () => {
    const store = useGranVideoEditorUiStore();
    store.restoreFileTreeStateOnce('demo');
    store.setFileTreePathExpanded('demo', 'sources', true);

    const stored = window.localStorage.getItem('gran-video-editor:file-tree:demo');
    expect(stored).toContain('sources');
  });
});
