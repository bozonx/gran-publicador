import { vi } from 'vitest';

// Nuxt auto-imported composables are not available in pure unit tests.
// Provide minimal mocks so composables can run.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).useI18n = () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: any) => String(key),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).useToast = () => ({
  add: vi.fn(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).useDebounceFn = (fn: any) => {
  const wrapped = (...args: any[]) => fn(...args);
  return wrapped;
};

vi.mock('#imports', () => ({
  useI18n: () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: (key: any) => String(key),
  }),
  useToast: () => ({
    add: vi.fn(),
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useDebounceFn: (fn: any) => {
    const wrapped = (...args: any[]) => fn(...args);
    return wrapped;
  },
}));
