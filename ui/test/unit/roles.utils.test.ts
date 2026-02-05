import { describe, expect, it } from 'vitest';

import { getRoleBadgeColor } from '~/utils/roles';

describe('utils/roles', () => {
  it('returns neutral for missing role', () => {
    expect(getRoleBadgeColor(undefined)).toBe('neutral');
    expect(getRoleBadgeColor(null)).toBe('neutral');
    expect(getRoleBadgeColor('')).toBe('neutral');
  });

  it('maps known roles (case-insensitive)', () => {
    expect(getRoleBadgeColor('owner')).toBe('primary');
    expect(getRoleBadgeColor('OWNER')).toBe('primary');

    expect(getRoleBadgeColor('admin')).toBe('secondary');
    expect(getRoleBadgeColor('editor')).toBe('info');
    expect(getRoleBadgeColor('viewer')).toBe('neutral');
  });

  it('returns neutral for unknown roles', () => {
    expect(getRoleBadgeColor('something')).toBe('neutral');
  });
});
