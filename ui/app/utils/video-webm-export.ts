import { Muxer, ArrayBufferTarget } from 'webm-muxer';

export interface WebMExportOptions {
  trimInUs: number;
  trimOutUs: number;
  bitrate: number;
  audioBitrate: number;
  audio: boolean;
}

/**
 * Exports a trimmed segment from an MP4Clip to WebM (VP9 + Opus) using
 * the WebCodecs API directly, bypassing WebAV's Combinator.
 *
 * Returns a ReadableStream<Uint8Array> compatible with uploadMediaStream.
 */
export async function exportToWebM(
  clip: any,
  { trimInUs, trimOutUs, bitrate, audioBitrate, audio }: WebMExportOptions,
): Promise<ReadableStream<Uint8Array>> {
  const { width, height, audioSampleRate, audioChanCount } = clip.meta;
  const hasAudio = audio && !!audioSampleRate;

  let videoWidth = Math.ceil((width || 1280) / 2) * 2;
  let videoHeight = Math.ceil((height || 720) / 2) * 2;
  const sampleRate: number = audioSampleRate || 48000;
  const channelCount: number = audioChanCount || 2;
  const trimDurationUs = trimOutUs - trimInUs;

  // Split at trim-in so tick() starts from time=0 of the trimmed segment,
  // matching the same approach used in the MP4 export branch.
  const [, clipFromIn] = await clip.split(trimInUs);
  const exportClip = trimInUs > 0 ? clipFromIn : clip;

  // Decode the first sample to infer the real coded size. The MP4 container meta
  // width/height may be different due to rotation/crop, which can make VP9 encoder
  // fail with OperationError on encode().
  const firstTick = await exportClip.tick(0);
  if (firstTick.video) {
    videoWidth = Math.ceil(firstTick.video.codedWidth / 2) * 2;
    videoHeight = Math.ceil(firstTick.video.codedHeight / 2) * 2;
    console.debug(
      '[WebM export] First frame coded size:',
      firstTick.video.codedWidth,
      firstTick.video.codedHeight,
    );
  }

  const muxerOptions: ConstructorParameters<typeof Muxer>[0] = {
    target: new ArrayBufferTarget(),
    video: {
      codec: 'V_VP9',
      width: videoWidth,
      height: videoHeight,
    },
    firstTimestampBehavior: 'offset',
  };

  if (hasAudio) {
    muxerOptions.audio = {
      codec: 'A_OPUS',
      numberOfChannels: channelCount,
      sampleRate,
    };
  }

  const muxer = new Muxer(muxerOptions);

  let encoderError: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? undefined),
    error: e => {
      console.error('[WebM export] VideoEncoder error:', e);
      encoderError = e;
    },
  });

  const vp9Config = {
    codec: 'vp09.00.10.08',
    width: videoWidth,
    height: videoHeight,
    bitrate,
    framerate: 30,
    latencyMode: 'quality' as const,
  };

  const vp9Support = await VideoEncoder.isConfigSupported(vp9Config).catch(() => null);
  if (!vp9Support?.supported) {
    throw new Error('VP9 encoding is not supported by this browser for the selected resolution');
  }

  videoEncoder.configure(vp9Config);

  let audioEncoder: AudioEncoder | null = null;
  if (hasAudio) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta ?? undefined),
      error: e => {
        console.error('[WebM export] AudioEncoder error:', e);
        encoderError = e;
      },
    });

    const opusConfig = {
      codec: 'opus',
      numberOfChannels: channelCount,
      sampleRate,
      bitrate: audioBitrate,
    };

    const opusSupport = await AudioEncoder.isConfigSupported(opusConfig).catch(() => null);
    if (!opusSupport?.supported) {
      throw new Error('Opus encoding is not supported by this browser');
    }

    audioEncoder.configure(opusConfig);
  }

  const frameDurationUs = Math.round(1_000_000 / 30);
  let currentTimeUs = 0;
  let frameIndex = 0;
  let audioTimestampUs = 0;

  // Process first tick (already decoded for size detection)
  let pendingVideo: VideoFrame | undefined = firstTick.video;
  let pendingAudio: Float32Array[] | undefined = firstTick.audio;
  let pendingState: 'success' | 'done' = firstTick.state;

  while (currentTimeUs < trimDurationUs) {
    if (encoderError !== null) throw encoderError;

    const tickRet =
      frameIndex === 0
        ? { video: pendingVideo, audio: pendingAudio, state: pendingState }
        : await exportClip.tick(currentTimeUs);

    const video = tickRet.video;
    const audioData = tickRet.audio;
    const state = tickRet.state;

    if (state === 'done') break;

    if (video) {
      if (videoEncoder.state === 'closed') throw new Error(`VideoEncoder closed: ${encoderError}`);
      const isKeyFrame = frameIndex % 150 === 0;
      // Normalize pixel format via OffscreenCanvas — VP9 encoder requires I420/NV12/RGBA.
      // H.264 High 4:2:2 profile produces I422 frames which VP9 rejects with OperationError.
      const normalized = normalizeFrame(video, videoWidth, videoHeight, currentTimeUs);
      video.close();
      videoEncoder.encode(normalized, { keyFrame: isKeyFrame });
      normalized.close();
    }

    if (audioEncoder && audioData && audioData.length > 0 && audioData[0]?.length > 0) {
      if (audioEncoder.state === 'closed') throw new Error(`AudioEncoder closed: ${encoderError}`);
      const numFrames = audioData[0].length;
      const audioBuffer = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: numFrames,
        numberOfChannels: channelCount,
        timestamp: audioTimestampUs,
        data: buildPlanarBuffer(audioData, channelCount, numFrames),
      });
      audioEncoder.encode(audioBuffer);
      audioBuffer.close();
      audioTimestampUs += Math.round((numFrames / sampleRate) * 1_000_000);
    }

    currentTimeUs += frameDurationUs;
    frameIndex++;
  }

  if (encoderError !== null) throw encoderError;

  await videoEncoder.flush();
  if (audioEncoder) await audioEncoder.flush();

  muxer.finalize();

  const { buffer } = muxer.target as ArrayBufferTarget;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });
}

/**
 * Draws a VideoFrame into an OffscreenCanvas and returns a new VideoFrame in RGBA format.
 * This normalizes any pixel format (I422, I444, NV12, etc.) to RGBA which VP9 encoder accepts.
 */
function normalizeFrame(
  frame: VideoFrame,
  width: number,
  height: number,
  timestampUs: number,
): VideoFrame {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(frame, 0, 0, width, height);
  return new VideoFrame(canvas, { timestamp: timestampUs });
}

/**
 * Builds a planar Float32Array buffer (channel0[...], channel1[...])
 * for use with AudioData in f32-planar format.
 */
function buildPlanarBuffer(
  channels: Float32Array[],
  channelCount: number,
  numFrames: number,
): Float32Array {
  const result = new Float32Array(channelCount * numFrames);
  for (let ch = 0; ch < channelCount; ch++) {
    const src = channels[ch];
    if (src) result.set(src.subarray(0, numFrames), ch * numFrames);
  }
  return result;
}
