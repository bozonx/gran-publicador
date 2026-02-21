import { beforeEach, describe, expect, it, vi } from 'vitest';

const appRender = vi.fn();

vi.mock('pixi.js', () => ({
  Application: class {
    canvas = document.createElement('canvas');
    stage = { addChild: vi.fn() };
    ticker = { stop: vi.fn() };

    async init() {
      return;
    }

    render() {
      appRender();
    }

    destroy() {
      return;
    }
  },
  Sprite: class {},
}));

vi.mock('mediabunny', () => ({
  Input: class {},
  VideoSampleSink: class {},
}));

describe('composables/useMediabunny', () => {
  beforeEach(() => {
    appRender.mockClear();
  });

  it('falls back to sample.draw when toCanvasImageSource cannot be drawn', async () => {
    const { useMediabunny } = await import('../../app/composables/useMediabunny');
    const mediaBunny = useMediabunny();

    mediaBunny.app.value = {
      render: appRender,
    } as any;

    const clearRect = vi.fn();
    const drawImage = vi.fn();
    const ctx = {
      clearRect,
      drawImage,
    } as any;

    const updateTexture = vi.fn();
    const sprite = {
      visible: false,
      texture: {
        source: {
          update: updateTexture,
        },
      },
    } as any;

    const sampleDraw = vi.fn();
    const sampleClose = vi.fn();

    const sample = {
      toCanvasImageSource: vi.fn(() => {
        throw new Error('drawImage path not supported');
      }),
      draw: sampleDraw,
      close: sampleClose,
    };

    const sink = {
      getSample: vi.fn(async () => sample),
    };

    mediaBunny.clips.value = [
      {
        startUs: 0,
        endUs: 1_000_000,
        durationUs: 1_000_000,
        sink,
        sprite,
        canvas: { width: 1920, height: 1080 },
        ctx,
        input: {},
        fileHandle: {} as FileSystemFileHandle,
      } as any,
    ];

    await mediaBunny.renderFrameAt(100_000);

    expect(sink.getSample).toHaveBeenCalledTimes(1);
    expect(sampleDraw).toHaveBeenCalledWith(ctx, 0, 0, 1920, 1080);
    expect(updateTexture).toHaveBeenCalledTimes(1);
    expect(sprite.visible).toBe(true);
    expect(sampleClose).toHaveBeenCalledTimes(1);
    expect(appRender).toHaveBeenCalledTimes(1);
  });
});
