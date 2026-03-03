import { vi } from 'vitest';
import { ref, isRef, reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

// 1. Initialize Pinia globally
setActivePinia(createPinia());

// 2. Shared mocks
const mockApi = {
  get: vi.fn(() => Promise.resolve({})),
  post: vi.fn(() => Promise.resolve({})),
  put: vi.fn(() => Promise.resolve({})),
  patch: vi.fn(() => Promise.resolve({})),
  delete: vi.fn(() => Promise.resolve({})),
  createAbortController: () => new AbortController(),
};

const mockConfig = reactive({
  public: {
    devMode: 'true',
    devTelegramId: '123456',
    apiBase: '',
    telegramBotName: 'gran_publicador_bot',
  },
});

const mockNavigateTo = vi.fn();

const mockArchive = {
  archiveEntity: vi.fn(() => Promise.resolve()),
  restoreEntity: vi.fn(() => Promise.resolve()),
};

// 3. Attach to globalThis for test files
(globalThis as any).mockApi = mockApi;
(globalThis as any).mockConfig = mockConfig;
(globalThis as any).mockNavigateTo = mockNavigateTo;
(globalThis as any).mockArchive = mockArchive;

// 4. Stub globals for auto-imports
vi.stubGlobal('useApi', () => (globalThis as any).mockApi);
vi.stubGlobal('useRuntimeConfig', () => (globalThis as any).mockConfig);
vi.stubGlobal('navigateTo', (globalThis as any).mockNavigateTo);
vi.stubGlobal('useArchive', () => (globalThis as any).mockArchive);
vi.stubGlobal('useI18n', () => ({ 
  t: (s: any) => String(s), 
  d: (date: any, options: any) => {
    const optStr = typeof options === 'string' ? options : (options ? JSON.stringify(options) : '');
    const dateStr = date instanceof Date ? date.toISOString() : String(date);
    return `${dateStr}|${optStr}`;
  },
  locale: ref('ru') 
}));
vi.stubGlobal('useToast', () => ({ add: vi.fn(), remove: vi.fn() }));
vi.stubGlobal('useApiAction', () => ({
    executeAction: async (fn: any) => {
        try {
            const res = await fn();
            return [null, res];
        } catch (e) {
            return [e, null];
        }
    }
}));
vi.stubGlobal('storeToRefs', (store: any) => {
  if (!store) return {};
  const refs: any = {};
  for (const key in store) {
    if (typeof store[key] !== 'function') {
      refs[key] = isRef(store[key]) ? store[key] : ref(store[key]);
    }
  }
  return refs;
});

// 5. Mock Nuxt virtual modules
vi.mock('#imports', () => ({
  useApi: () => (globalThis as any).mockApi,
  useRuntimeConfig: () => (globalThis as any).mockConfig,
  navigateTo: (...args: any[]) => (globalThis as any).mockNavigateTo(...args),
  useArchive: () => (globalThis as any).mockArchive,
  useI18n: () => ({ 
    t: (s: any) => String(s), 
    d: (date: any, options: any) => {
      const optStr = typeof options === 'string' ? options : (options ? JSON.stringify(options) : '');
      const dateStr = date instanceof Date ? date.toISOString() : String(date);
      return `${dateStr}|${optStr}`;
    },
    locale: ref('ru') 
  }),
  useToast: () => ({ add: vi.fn(), remove: vi.fn() }),
  useApiAction: () => ({
    executeAction: async (fn: any) => {
      try {
        const res = await fn();
        return [null, res];
      } catch (e) {
        return [e, null];
      }
    }
  }),
  storeToRefs: (store: any) => {
    if (!store) return {};
    const refs: any = {};
    for (const key in store) {
      if (typeof store[key] !== 'function') {
        refs[key] = isRef(store[key]) ? store[key] : ref(store[key]);
      }
    }
    return refs;
  },
  useNuxtApp: () => ({
    $i18n: { t: (s: any) => String(s) },
    runWithContext: (fn: any) => fn(),
  }),
}));

vi.mock('#app', () => ({
  useRuntimeConfig: () => (globalThis as any).mockConfig,
  navigateTo: (...args: any[]) => (globalThis as any).mockNavigateTo(...args),
  useNuxtApp: () => ({
    $i18n: { t: (s: any) => String(s) },
    runWithContext: (fn: any) => fn(),
  }),
  defineNuxtPlugin: (plugin: any) => plugin,
  defineNuxtComponent: (comp: any) => comp,
}));

// Basic mock for vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ 
    t: (s: any) => String(s), 
    d: (date: any, options: any) => {
      const optStr = typeof options === 'string' ? options : (options ? JSON.stringify(options) : '');
      const dateStr = date instanceof Date ? date.toISOString() : String(date);
      return `${dateStr}|${optStr}`;
    },
    locale: ref('ru') 
  }),
  createI18n: () => ({ global: {}, install: () => {} }),
}));
