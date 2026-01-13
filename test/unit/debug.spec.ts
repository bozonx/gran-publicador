import { describe, it, expect } from '@jest/globals';
import nock from 'nock';

describe('Debug Test', () => {
  it('should run correctly in ESM mode', () => {
    expect(nock).toBeDefined();
    expect(true).toBe(true);
  });
});
