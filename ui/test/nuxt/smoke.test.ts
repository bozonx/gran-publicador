import { describe, expect, it } from 'vitest';

describe('nuxt smoke', () => {
  it('can access runtime config', () => {
    const config = useRuntimeConfig();
    expect(config).toBeTruthy();
  });
});
