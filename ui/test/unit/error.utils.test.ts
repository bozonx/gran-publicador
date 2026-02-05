import { describe, expect, it } from 'vitest';

import { formatError } from '../../app/utils/error';

describe('utils/error', () => {
  it('formats Error instances', () => {
    expect(formatError(new Error('boom'))).toBe('boom');
  });

  it('formats string errors', () => {
    expect(formatError('oops')).toBe('oops');
  });

  it('formats objects with message field', () => {
    expect(formatError({ message: 'x' })).toBe('x');
    expect(formatError({ message: 123 })).toBe('123');
  });

  it('falls back to unknown error', () => {
    expect(formatError({})).toBe('Unknown error');
    expect(formatError(123)).toBe('Unknown error');
    expect(formatError(null)).toBe('Unknown error');
  });
});
