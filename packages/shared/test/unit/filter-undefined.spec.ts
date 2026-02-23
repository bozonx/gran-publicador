import { filterUndefined } from '../../src/utils/object';

describe('filterUndefined', () => {
  it('removes keys with undefined values', () => {
    const input = {
      a: 1,
      b: undefined,
      c: 'x',
    };

    const result = filterUndefined(input);

    expect(result).toEqual({
      a: 1,
      c: 'x',
    });
  });
});
