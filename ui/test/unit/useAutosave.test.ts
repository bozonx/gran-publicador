import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';

import { useAutosave } from '../../app/composables/useAutosave';

describe('composables/useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('forceSave triggers save even when data equals baseline', async () => {
    const saveFn = vi.fn(async () => ({ saved: true }));
    const data = ref({ a: 1 });

    const Comp = defineComponent({
      setup(_, { expose }) {
        const autosave = useAutosave({
          data,
          saveFn,
          debounceMs: 0,
          skipInitial: true,
        });

        expose({ autosave });
        return () => h('div');
      },
    });

    const wrapper = mount(Comp);
    const autosave = (wrapper.vm as any).autosave as ReturnType<typeof useAutosave>;

    await autosave.forceSave();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(autosave.saveStatus.value).toBe('saved');
  });

  it('shows error toast and retries every 3 seconds until successful', async () => {
    const calls: Array<'fail' | 'ok'> = ['fail', 'ok'];
    const saveFn = vi.fn(async () => {
      const next = calls.shift() ?? 'ok';
      if (next === 'fail') throw new Error('boom');
      return { saved: true };
    });

    const data = ref({ a: 1 });

    const Comp = defineComponent({
      setup(_, { expose }) {
        const autosave = useAutosave({
          data,
          saveFn,
          debounceMs: 0,
          skipInitial: true,
        });

        expose({ autosave });
        return () => h('div');
      },
    });

    const wrapper = mount(Comp);
    const autosave = (wrapper.vm as any).autosave as ReturnType<typeof useAutosave>;

    // Make it dirty to trigger save
    data.value = { a: 2 };
    await nextTick();

    // Wait for the queued save to finish (performSave uses an internal promise chain)
    await Promise.resolve();
    await Promise.resolve();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(autosave.saveStatus.value).toBe('error');
    expect(autosave.isDirty.value).toBe(true);

    // First retry after 3s
    await vi.advanceTimersByTimeAsync(3000);

    await Promise.resolve();
    await Promise.resolve();

    expect(saveFn).toHaveBeenCalledTimes(2);
    expect(autosave.saveStatus.value).toBe('saved');
    expect(autosave.isDirty.value).toBe(false);

    wrapper.unmount();
  });

  it('syncBaseline clears dirty/error and hides indicator without saving', async () => {
    const saveFn = vi.fn(async () => ({ saved: true }));
    const data = ref({ a: 1 });

    const Comp = defineComponent({
      setup(_, { expose }) {
        const autosave = useAutosave({
          data,
          saveFn,
          debounceMs: 0,
          skipInitial: true,
        });

        expose({ autosave });
        return () => h('div');
      },
    });

    const wrapper = mount(Comp);
    const autosave = (wrapper.vm as any).autosave as ReturnType<typeof useAutosave>;

    data.value = { a: 2 };
    await nextTick();

    expect(autosave.isDirty.value).toBe(true);

    autosave.syncBaseline();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(autosave.isDirty.value).toBe(false);
    expect(autosave.saveStatus.value).toBe('saved');
    expect(autosave.isIndicatorVisible.value).toBe(false);

    wrapper.unmount();
  });
});
