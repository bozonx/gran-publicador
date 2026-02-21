import { Muxer, StreamTarget } from 'webm-muxer';

export interface ContainerExportOptions {
  format: 'webm' | 'mkv';
  trimInUs: number;
  trimOutUs: number;
  bitrate: number;
  audioBitrate: number;
  audio: boolean;
}

const FORMAT_CONFIG = {
  webm: {
    muxerType: 'webm' as const,
    videoMuxCodec: 'V_VP9' as const,
    audioMuxCodec: 'A_OPUS' as const,
    videoEncCodec: 'vp09.00.10.08',
  },
  mkv: {
    muxerType: 'matroska' as const,
    videoMuxCodec: 'V_AV1' as const,
    audioMuxCodec: 'A_OPUS' as const,
    videoEncCodec: 'av01.0.05M.08',
  },
} as const;

/**
 * Exports a trimmed segment from an MP4Clip to WebM (VP9 + Opus) or MKV (AV1 + Opus)
 * using the WebCodecs API directly, bypassing WebAV's Combinator.
 *
 * Returns a ReadableStream<Uint8Array> compatible with uploadMediaStream.
 */
export async function exportToContainer(
  clip: any,
  { format, trimInUs, trimOutUs, bitrate, audioBitrate, audio }: ContainerExportOptions,
): Promise<ReadableStream<Uint8Array>> {
  const { muxerType, videoMuxCodec, audioMuxCodec, videoEncCodec } = FORMAT_CONFIG[format];
  const { width, height, audioSampleRate, audioChanCount } = clip.meta;
  const hasAudio = audio && !!audioSampleRate;

  let videoWidth = Math.ceil((width || 1280) / 2) * 2;
  let videoHeight = Math.ceil((height || 720) / 2) * 2;
  const sampleRate: number = audioSampleRate || 48000;
  const channelCount: number = audioChanCount || 2;
  const clipDurationUs: number = Number(clip?.meta?.duration) || 0;

  const safeTrimInUs = Math.max(
    0,
    Math.min(Number(trimInUs) || 0, clipDurationUs || Number.POSITIVE_INFINITY),
  );
  const safeTrimOutUs = Math.max(
    safeTrimInUs,
    Math.min(Number(trimOutUs) || 0, clipDurationUs || Number.POSITIVE_INFINITY),
  );

  const trimDurationUs = safeTrimOutUs - safeTrimInUs;
  if (!Number.isFinite(trimDurationUs) || trimDurationUs <= 0) {
    throw new Error('Invalid trim range');
  }

  // Split at trim-in so tick() starts from time=0 of the trimmed segment,
  // matching the same approach used in the MP4 export branch.
  const exportClip =
    safeTrimInUs > 0 && typeof clip?.split === 'function'
      ? (await clip.split(safeTrimInUs))[1]
      : clip;

  // Decode the first sample to infer the real coded size. The MP4 container meta
  // width/height may be different due to rotation/crop, which can make the encoder
  // fail with OperationError on encode().
  //
  // IMPORTANT: For some generated MP4 streams the decoder may temporarily stall at t=0.
  // We must not hard-fail here; fall back to container metadata.
  let firstTick: {
    video?: VideoFrame;
    audio: Float32Array[];
    state: 'success' | 'done';
  } | null = null;
  try {
    const tick0 = await exportClip.tick(0);
    firstTick = tick0;
    if (tick0.video) {
      videoWidth = Math.ceil(tick0.video.codedWidth / 2) * 2;
      videoHeight = Math.ceil(tick0.video.codedHeight / 2) * 2;
      console.debug(
        `[${format} export] First frame coded size:`,
        tick0.video.codedWidth,
        tick0.video.codedHeight,
      );
    }
  } catch (e) {
    console.error(`[${format} export] Failed to decode first frame at t=0, using meta size`, e);
  }

  // StreamTarget delivers chunks to the ReadableStream as they are produced,
  // so encoding and upload can run in parallel — same pattern as Combinator.output().
  // Typed as unknown first to prevent TypeScript control-flow narrowing to never
  // when the variable is assigned inside a callback and checked later.
  let streamController: ReadableStreamDefaultController<Uint8Array> | null =
    null as ReadableStreamDefaultController<Uint8Array> | null;

  const outputStream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
  });

  const muxerOptions: ConstructorParameters<typeof Muxer>[0] = {
    target: new StreamTarget({
      onData: (data, _position) => streamController?.enqueue(data.slice()),
      chunked: true,
    }),
    // streaming: true ensures data is written monotonically so position can be ignored.
    // Without it, the muxer may patch earlier byte offsets (e.g. duration in the header)
    // which is incompatible with a forward-only ReadableStream.
    streaming: true,
    type: muxerType,
    video: {
      codec: videoMuxCodec,
      width: videoWidth,
      height: videoHeight,
    },
    firstTimestampBehavior: 'offset',
  };

  if (hasAudio) {
    muxerOptions.audio = {
      codec: audioMuxCodec,
      numberOfChannels: channelCount,
      sampleRate,
    };
  }

  const muxer = new Muxer(muxerOptions);

  let encoderError: Error | null = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? undefined),
    error: e => {
      console.error(`[${format} export] VideoEncoder error:`, e);
      encoderError = e;
    },
  });

  const videoEncConfig = {
    codec: videoEncCodec,
    width: videoWidth,
    height: videoHeight,
    bitrate,
    framerate: 30,
    latencyMode: 'quality' as const,
  };

  const videoSupport = await VideoEncoder.isConfigSupported(videoEncConfig).catch(() => null);
  if (!videoSupport?.supported) {
    throw new Error(`${format.toUpperCase()} video encoding is not supported by this browser`);
  }

  videoEncoder.configure(videoEncConfig);

  let audioEncoder: AudioEncoder | null = null;
  if (hasAudio) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta ?? undefined),
      error: e => {
        console.error(`[${format} export] AudioEncoder error:`, e);
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
  let pendingVideo: VideoFrame | undefined = firstTick?.video;
  let pendingAudio: Float32Array[] | undefined = firstTick?.audio;
  let pendingState: 'success' | 'done' = firstTick?.state ?? 'success';

  while (currentTimeUs < trimDurationUs) {
    if (encoderError !== null) throw encoderError;

    const tickRet =
      frameIndex === 0 && firstTick !== null
        ? { video: pendingVideo, audio: pendingAudio, state: pendingState }
        : await exportClip.tick(currentTimeUs);

    const video = tickRet.video;
    const audioData = tickRet.audio;
    const state = tickRet.state;

    if (state === 'done') break;

    if (video) {
      if (videoEncoder.state === 'closed') throw new Error(`VideoEncoder closed: ${encoderError}`);
      const isKeyFrame = frameIndex % 150 === 0;
      // Normalize pixel format via OffscreenCanvas — VP9/AV1 encoders require I420/NV12/RGBA.
      // H.264 High 4:2:2 profile produces I422 frames which they reject with OperationError.
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

    // Backpressure: avoid runaway encode queues that can stall decoders in some browsers.
    if (videoEncoder.encodeQueueSize > 2) {
      await videoEncoder.flush();
    }
    if (audioEncoder && audioEncoder.encodeQueueSize > 4) {
      await audioEncoder.flush();
    }
    if (frameIndex % 30 === 0) {
      await new Promise<void>(r => setTimeout(r, 0));
    }

    currentTimeUs += frameDurationUs;
    frameIndex++;
  }

  if (encoderError !== null) throw encoderError;

  await videoEncoder.flush();
  if (audioEncoder) await audioEncoder.flush();

  muxer.finalize();
  if (streamController !== null) streamController.close();

  return outputStream;
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
