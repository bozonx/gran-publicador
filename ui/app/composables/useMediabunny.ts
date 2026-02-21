import { ref, shallowRef } from 'vue';
import { Application, Sprite } from 'pixi.js';
import { Input, VideoSampleSink } from 'mediabunny';

export interface MonitorClipData {
  fileHandle: FileSystemFileHandle;
  input: Input;
  sink: VideoSampleSink;
  startUs: number;
  endUs: number;
  durationUs: number;
  sprite: Sprite;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
}

export function useMediabunny() {
  const app = shallowRef<Application | null>(null);
  const clips = shallowRef<MonitorClipData[]>([]);

  const currentTimeUs = ref(0);
  const isPlaying = ref(false);
  const durationUs = ref(0);

  let animationFrameId = 0;
  let lastFrameTimeMs = 0;
  let renderQueue: Promise<void> = Promise.resolve();

  function disposeResource(resource: unknown) {
    if (!resource || typeof resource !== 'object') return;
    if (
      'dispose' in resource &&
      typeof (resource as { dispose?: unknown }).dispose === 'function'
    ) {
      (resource as { dispose: () => void }).dispose();
      return;
    }
    if ('close' in resource && typeof (resource as { close?: unknown }).close === 'function') {
      (resource as { close: () => void }).close();
    }
  }

  async function drawSampleToCanvas(sample: any, clip: MonitorClipData) {
    clip.ctx.clearRect(0, 0, clip.canvas.width, clip.canvas.height);

    let imageSource: any;
    try {
      imageSource = typeof sample.toCanvasImageSource === 'function' ? sample.toCanvasImageSource() : sample;
      const frameW = imageSource?.displayWidth ?? imageSource?.width ?? clip.canvas.width;
      const frameH = imageSource?.displayHeight ?? imageSource?.height ?? clip.canvas.height;
      const scale = Math.min(clip.canvas.width / frameW, clip.canvas.height / frameH);

      const targetW = frameW * scale;
      const targetH = frameH * scale;
      const targetX = (clip.canvas.width - targetW) / 2;
      const targetY = (clip.canvas.height - targetH) / 2;

      try {
        clip.ctx.drawImage(imageSource, targetX, targetY, targetW, targetH);
        return;
      } catch (err) {
        console.warn('[Monitor] drawImage error directly, trying createImageBitmap fallback', err);
        const bmp = await createImageBitmap(imageSource);
        clip.ctx.drawImage(bmp, targetX, targetY, targetW, targetH);
        bmp.close();
        return;
      }
    } catch (err) {
      console.warn('[Monitor] drawImage total failure:', err, 'sample:', sample);
      // Fallback for browsers/codecs where toCanvasImageSource() cannot be drawn
      // on an OffscreenCanvas 2D context.
    }

    if (typeof sample.draw === 'function') {
      sample.draw(clip.ctx, 0, 0, clip.canvas.width, clip.canvas.height);
      return;
    }

    throw new Error('Unable to draw video sample on canvas');
  }

  async function initCanvas(
    container: HTMLElement,
    width: number,
    height: number,
    bgColor: string,
  ) {
    destroyCanvas();
    const newApp = new Application();
    await newApp.init({
      width,
      height,
      backgroundColor: bgColor,
      preference: 'webgl',
    });
    newApp.ticker.stop();
    container.appendChild(newApp.canvas);
    app.value = newApp;
  }

  function destroyCanvas() {
    pause();
    renderQueue = Promise.resolve();
    for (const clip of clips.value) {
      disposeResource(clip.sink);
      disposeResource(clip.input);
    }
    clips.value = [];
    if (app.value) {
      if (app.value.canvas && app.value.canvas.parentNode) {
        app.value.canvas.parentNode.removeChild(app.value.canvas);
      }
      app.value.destroy(true, { children: true, texture: true });
      app.value = null;
    }
  }

  async function renderFrameAt(timeUs: number) {
    if (!app.value) return;

    for (const clip of clips.value) {
      if (timeUs >= clip.startUs && timeUs < clip.endUs) {
        const localTimeS = (timeUs - clip.startUs) / 1_000_000;
        try {
          const fetchTimeS = Math.max(0, localTimeS);
          const sample = await clip.sink.getSample(fetchTimeS);

          if (sample) {
            await drawSampleToCanvas(sample, clip);
            clip.sprite.texture.source.update();
            clip.sprite.visible = true;

            if ('close' in sample) (sample as any).close();
          } else {
            console.log(`[Monitor] getSample(${fetchTimeS}) returned null for clip.`);
            clip.sprite.visible = false;
          }
        } catch (e) {
          console.error('[Monitor] Failed to render sample', e);
        }
      } else {
        clip.sprite.visible = false;
      }
    }

    app.value.render();
  }

  function enqueueRenderFrame(timeUs: number) {
    renderQueue = renderQueue
      .then(() => renderFrameAt(timeUs))
      .catch(e => {
        console.error('[Monitor] Failed to render queued frame', e);
      });

    return renderQueue;
  }

  function loop(timestamp: number) {
    if (!isPlaying.value) return;
    const deltaMs = timestamp - lastFrameTimeMs;
    lastFrameTimeMs = timestamp;

    let newTime = currentTimeUs.value + deltaMs * 1000;
    if (newTime >= durationUs.value) {
      newTime = durationUs.value;
      isPlaying.value = false;
      enqueueRenderFrame(newTime).then(() => {
        currentTimeUs.value = newTime;
      });
      return;
    }

    currentTimeUs.value = newTime;
    enqueueRenderFrame(newTime);

    if (isPlaying.value) {
      animationFrameId = requestAnimationFrame(loop);
    }
  }

  function play(start?: number, end?: number) {
    if (isPlaying.value) return;
    if (typeof start === 'number') currentTimeUs.value = start;
    isPlaying.value = true;
    lastFrameTimeMs = performance.now();
    animationFrameId = requestAnimationFrame(loop);
  }

  function pause() {
    if (!isPlaying.value) return;
    isPlaying.value = false;
    cancelAnimationFrame(animationFrameId);
  }

  async function seek(timeUs: number) {
    currentTimeUs.value = Math.min(Math.max(0, timeUs), durationUs.value);
    if (!isPlaying.value) {
      await enqueueRenderFrame(currentTimeUs.value);
    }
  }

  return {
    app,
    clips,
    currentTimeUs,
    durationUs,
    isPlaying,
    initCanvas,
    destroyCanvas,
    play,
    pause,
    seek,
    renderFrameAt,
  };
}
