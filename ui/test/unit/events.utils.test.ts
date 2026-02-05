import { describe, expect, it, vi } from 'vitest';

import { eventBus } from '~/utils/events';

describe('utils/events', () => {
  it('calls listeners on emit', () => {
    const cb = vi.fn();

    eventBus.on('ping', cb);
    eventBus.emit('ping', 1, 'a');

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1, 'a');

    eventBus.off('ping', cb);
  });

  it('does not call removed listeners', () => {
    const cb = vi.fn();

    eventBus.on('pong', cb);
    eventBus.off('pong', cb);
    eventBus.emit('pong');

    expect(cb).not.toHaveBeenCalled();
  });

  it('supports multiple listeners', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    eventBus.on('multi', cb1);
    eventBus.on('multi', cb2);

    eventBus.emit('multi', 'x');

    expect(cb1).toHaveBeenCalledWith('x');
    expect(cb2).toHaveBeenCalledWith('x');

    eventBus.off('multi', cb1);
    eventBus.off('multi', cb2);
  });
});
