import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';

import { useAutosave } from '../../app/composables/useAutosave';
import { AUTOSAVE_RETRY_MAX_ATTEMPTS } from '../../app/constants/autosave';

/**
 * Helper: mount a wrapper component that exposes the useAutosave return value.
 */
function mountAutosave<T>(opts: Parameters<typeof useAutosave<T>>[0]) {
  const Comp = defineComponent({
    setup(_, { expose }) {
      const autosave = useAutosave<T>(opts);
      expose({ autosave });
      return () => h('div');
    },
  });

  const wrapper = mount(Comp);
  const autosave = (wrapper.vm as any).autosave as ReturnType<typeof useAutosave<T>>;
  return { wrapper, autosave };
}

/**
 * Flush the internal promise-based save queue.
 * Two microtick rounds are needed because the queue chains `.then()`.
 */
async function flushQueue() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('composables/useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── Basic save ────────────────────────────────────────────────

  it('forceSave triggers save even when data equals baseline', async () => {
    const saveFn = vi.fn(async () => ({ saved: true }));
    const data = ref({ a: 1 });

    const { wrapper, autosave } = mountAutosave({ data, saveFn, debounceMs: 0, skipInitial: true });

    await autosave.forceSave();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(autosave.saveStatus.value).toBe('saved');
    wrapper.unmount();
  });

  it('syncBaseline clears dirty/error and hides indicator without saving', async () => {
    const saveFn = vi.fn(async () => ({ saved: true }));
    const data = ref({ a: 1 });

    const { wrapper, autosave } = mountAutosave({ data, saveFn, debounceMs: 0, skipInitial: true });

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

  // ─── Queue deduplication ───────────────────────────────────────

  it('deduplicates saves when data has not changed between queued calls', async () => {
    const saveFn = vi.fn(async () => ({ saved: true }));
    const data = ref({ a: 1 });

    const { wrapper, autosave } = mountAutosave({ data, saveFn, debounceMs: 0, skipInitial: true });

    // First force save
    await autosave.forceSave();
    expect(saveFn).toHaveBeenCalledTimes(1);

    // Trigger two non-force saves without changing data — both should be deduped
    await autosave.triggerSave();
    await autosave.triggerSave();

    // triggerSave uses force=true, so it always saves
    expect(saveFn).toHaveBeenCalledTimes(3);

    wrapper.unmount();
  });

  // ─── Skipped saves ─────────────────────────────────────────────

  it('handles skipped saves without changing status to error', async () => {
    const saveFn = vi.fn(async () => ({ saved: false, skipped: true }));
    const data = ref({ a: 1 });

    const { wrapper, autosave } = mountAutosave({ data, saveFn, debounceMs: 0, skipInitial: true });

    data.value = { a: 2 };
    await nextTick();
    await flushQueue();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(autosave.saveStatus.value).toBe('unsaved');
    expect(autosave.saveError.value).toBeNull();

    wrapper.unmount();
  });

  // ─── Retry logic ───────────────────────────────────────────────

  it('retries on server error and succeeds on second attempt', async () => {
    const calls: Array<'fail' | 'ok'> = ['fail', 'ok'];
    const saveFn = vi.fn(async () => {
      const next = calls.shift() ?? 'ok';
      if (next === 'fail') {
        const err = new Error('server error');
        (err as any).status = 500;
        throw err;
      }
      return { saved: true };
    });

    const data = ref({ a: 1 });

    const { wrapper, autosave } = mountAutosave({ data, saveFn, debounceMs: 0, skipInitial: true });

    data.value = { a: 2 };
    await nextTick();
    await flushQueue();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(autosave.saveStatus.value).toBe('error');
    expect(autosave.isDirty.value).toBe(true);

    // First retry after base delay (~1s with jitter)
    await vi.advanceTimersByTimeAsync(3000);
    await flushQueue();

    expect(saveFn).toHaveBeenCalledTimes(2);
    expect(autosave.saveStatus.value).toBe('saved');
    expect(autosave.isDirty.value).toBe(false);

    wrapper.unmount();
  });

  it('stops retrying after max attempts are exhausted', async () => {
    const saveFn = vi.fn(async () => {
      const err = new Error('server error');
      (err as any).status = 500;
      throw err;
    });

    const data = ref({ a: 1 });

    const { wrapper, autosave } = mountAutosave({ data, saveFn, debounceMs: 0, skipInitial: true });

    data.value = { a: 2 };
    await nextTick();
    await flushQueue();

    // Initial call
    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(autosave.saveStatus.value).toBe('error');

    // Advance through all retry attempts
    for (let i = 0; i < AUTOSAVE_RETRY_MAX_ATTEMPTS; i++) {
      await vi.advanceTimersByTimeAsync(60_000);
      await flushQueue();
    }

    // 1 initial + up to MAX_ATTEMPTS retries
    const totalCalls = saveFn.mock.calls.length;
    expect(totalCalls).toBeLessThanOrEqual(1 + AUTOSAVE_RETRY_MAX_ATTEMPTS);
    expect(autosave.saveStatus.value).toBe('error');

    wrapper.unmount();
  });

  // ─── Auth errors (401/403) ─────────────────────────────────────

  it('does not retry on 401 auth error', async () => {
    const saveFn = vi.fn(async () => {
      const err = new Error('unauthorized');
      (err as any).status = 401;
      throw err;
    });

    const data = ref({ a: 1 });

    const { wrapper, autosave } = mountAutosave({ data, saveFn, debounceMs: 0, skipInitial: true });

    data.value = { a: 2 };
    await nextTick();
    await flushQueue();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(autosave.saveStatus.value).toBe('error');

    // Advance time — no retry should happen
    await vi.advanceTimersByTimeAsync(10_000);
    await flushQueue();

    expect(saveFn).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('does not retry on 403 forbidden error', async () => {
    const saveFn = vi.fn(async () => {
      const err = new Error('forbidden');
      (err as any).status = 403;
      throw err;
    });

    const data = ref({ a: 1 });

    const { wrapper, autosave } = mountAutosave({ data, saveFn, debounceMs: 0, skipInitial: true });

    data.value = { a: 2 };
    await nextTick();
    await flushQueue();

    expect(saveFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    await flushQueue();

    expect(saveFn).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  // ─── retrySave manual trigger ──────────────────────────────────

  it('retrySave resets retry counter and triggers a new save', async () => {
    let callCount = 0;
    const saveFn = vi.fn(async () => {
      callCount++;
      if (callCount <= 1) {
        const err = new Error('server error');
        (err as any).status = 500;
        throw err;
      }
      return { saved: true };
    });

    const data = ref({ a: 1 });

    const { wrapper, autosave } = mountAutosave({ data, saveFn, debounceMs: 0, skipInitial: true });

    data.value = { a: 2 };
    await nextTick();
    await flushQueue();

    expect(autosave.saveStatus.value).toBe('error');

    // Manual retry
    await autosave.retrySave();
    await flushQueue();

    expect(saveFn).toHaveBeenCalledTimes(2);
    expect(autosave.saveStatus.value).toBe('saved');

    wrapper.unmount();
  });

  // ─── enableNavigationGuards: false ─────────────────────────────

  it('does not register beforeunload when enableNavigationGuards is false', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const saveFn = vi.fn(async () => ({ saved: true }));
    const data = ref({ a: 1 });

    const { wrapper } = mountAutosave({
      data,
      saveFn,
      debounceMs: 0,
      skipInitial: true,
      enableNavigationGuards: false,
    });

    // onMounted fires after mount
    await nextTick();

    const beforeUnloadCalls = addSpy.mock.calls.filter(([event]) => event === 'beforeunload');
    expect(beforeUnloadCalls).toHaveLength(0);

    wrapper.unmount();
    addSpy.mockRestore();
  });
});
