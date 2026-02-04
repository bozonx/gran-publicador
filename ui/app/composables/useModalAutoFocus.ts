import { nextTick, type MaybeRefOrGetter, unref, watch, type Ref } from 'vue';

interface FocusCandidate {
  /**
   * Can be an element, a component instance (with $el), or a function that returns one.
   */
  target: MaybeRefOrGetter<unknown>;
}

interface UseModalAutoFocusOptions {
  open: Ref<boolean>;
  root: Ref<HTMLElement | null>;
  candidates: MaybeRefOrGetter<FocusCandidate[]>;
  enabled?: MaybeRefOrGetter<boolean>;
}

const FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'button:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function resolveMaybeRefOrGetter<T>(value: MaybeRefOrGetter<T>): T {
  const resolved = unref(value as any) as any;
  if (typeof resolved === 'function') {
    return resolved();
  }
  return resolved as T;
}

function toElement(value: unknown): HTMLElement | null {
  if (!value) return null;

  if (value instanceof HTMLElement) return value;

  const maybeComponent = value as { $el?: unknown };
  if (maybeComponent.$el instanceof HTMLElement) return maybeComponent.$el;

  return null;
}

function isWithinRoot(root: HTMLElement | null, el: Element | null): boolean {
  if (!root || !el) return false;
  return root === el || root.contains(el);
}

function resolveFocusable(el: HTMLElement): HTMLElement | null {
  if (el.matches(FOCUSABLE_SELECTOR)) return el;

  const inside = el.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  return inside || null;
}

async function waitForOpenRender(): Promise<void> {
  await nextTick();

  await new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });

  await new Promise<void>(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

function focusElement(el: HTMLElement): boolean {
  try {
    el.focus({ preventScroll: true });
    return true;
  } catch {
    try {
      el.focus();
      return true;
    } catch {
      return false;
    }
  }
}

export function useModalAutoFocus(options: UseModalAutoFocusOptions) {
  const enabled = options.enabled;

  let hasFocusedForOpen = false;

  watch(
    options.open,
    async open => {
      if (!open) {
        hasFocusedForOpen = false;
        return;
      }

      if (enabled !== undefined && !unref(enabled)) return;

      await waitForOpenRender();

      if (hasFocusedForOpen) return;

      const rootEl = options.root.value;
      const activeEl = document.activeElement;

      if (isWithinRoot(rootEl, activeEl)) {
        hasFocusedForOpen = true;
        return;
      }

      const candidates = resolveMaybeRefOrGetter(options.candidates);

      for (const candidate of candidates) {
        const raw = resolveMaybeRefOrGetter(candidate.target);
        const el = toElement(raw);

        if (!el) continue;

        const focusable = resolveFocusable(el);
        if (!focusable) continue;

        if (focusElement(focusable)) {
          hasFocusedForOpen = true;
          return;
        }
      }

      if (rootEl) {
        const fallback = rootEl.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (fallback && focusElement(fallback)) {
          hasFocusedForOpen = true;
        }
      }
    },
    { flush: 'post' },
  );

  return {};
}
