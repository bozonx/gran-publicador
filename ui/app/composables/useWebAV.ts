import { ref, shallowRef, markRaw } from 'vue'
import {
  BASE_VIDEO_CODEC_OPTIONS,
  checkVideoCodecSupport,
  checkAudioCodecSupport,
} from '~/utils/webcodecs';

export function useWebAV() {
  const { t } = useI18n();

  const supportStatus = ref<'full' | 'partial' | 'none' | null>(null);
  const isWebCodecsSupported = ref(false);

  const isPlaying = ref(false)
  const currentTimeUs = ref(0)
  const durationUs = ref(0)
  const avCanvas = shallowRef<any>(null)

  let unsubscribers: Array<() => void> = []

  async function checkSupport() {
    const [videoSupport, audioSupport] = await Promise.all([
      checkVideoCodecSupport(BASE_VIDEO_CODEC_OPTIONS),
      checkAudioCodecSupport([
        { value: 'mp4a.40.2', label: 'AAC' },
        { value: 'opus', label: 'Opus' },
      ]),
    ]);

    const hasH264 = BASE_VIDEO_CODEC_OPTIONS.some(opt => videoSupport[opt.value]);
    const hasAAC = audioSupport['mp4a.40.2'];
    const hasOpus = audioSupport['opus'];

    if (!(globalThis as any).VideoEncoder) {
      supportStatus.value = 'none';
      isWebCodecsSupported.value = false;
    } else if (hasH264 && (hasAAC || hasOpus)) {
      supportStatus.value = 'full';
      isWebCodecsSupported.value = true;
    } else {
      supportStatus.value = 'partial';
      isWebCodecsSupported.value = true;
    }

    return { supportStatus: supportStatus.value, isWebCodecsSupported: isWebCodecsSupported.value };
  }

  async function initCanvas(
    containerEl: HTMLElement,
    width: number = 1280,
    height: number = 720,
    bgColor: string = '#000',
  ) {
    destroyCanvas()
    const { AVCanvas } = await import('@webav/av-canvas')
    avCanvas.value = markRaw(new AVCanvas(containerEl, {
      bgColor,
      width,
      height,
    }))

    const offTime = avCanvas.value.on('timeupdate', (time: number) => {
      currentTimeUs.value = time;
    });

    const offPaused = avCanvas.value.on('paused', () => {
      isPlaying.value = false;
    });

    const offPlaying = avCanvas.value.on('playing', () => {
      isPlaying.value = true;
    });

    unsubscribers.push(offTime, offPaused, offPlaying);

    return avCanvas.value;
  }

  function play(start?: number, end?: number) {
    if (!avCanvas.value) return;
    avCanvas.value.play({ start, end });
  }

  function pause() {
    avCanvas.value?.pause();
  }

  function togglePlayPause(start?: number, end?: number) {
    if (isPlaying.value) {
      pause();
    } else {
      play(start, end);
    }
  }

  async function seek(timeUs: number) {
    const wasPlaying = isPlaying.value;
    if (wasPlaying) pause();

    currentTimeUs.value = timeUs;
    await avCanvas.value?.previewFrame(timeUs);

    if (wasPlaying) play();
  }

  function destroyCanvas() {
    unsubscribers.forEach(fn => {
      fn();
    });
    unsubscribers = [];
    if (avCanvas.value) {
      avCanvas.value.destroy();
      avCanvas.value = null;
    }
    isPlaying.value = false;
    currentTimeUs.value = 0;
  }

  return {
    supportStatus,
    isWebCodecsSupported,
    isPlaying,
    currentTimeUs,
    durationUs,
    avCanvas,

    checkSupport,
    initCanvas,
    play,
    pause,
    togglePlayPause,
    seek,
    destroyCanvas,
  };
}
