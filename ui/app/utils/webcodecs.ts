export interface VideoCodecOption {
  value: string
  label: string
}

export interface VideoCodecOptionResolved extends VideoCodecOption {
  disabled: boolean
}

export const BASE_VIDEO_CODEC_OPTIONS: readonly VideoCodecOption[] = [
  { value: 'avc1.42E032', label: 'H.264 (Baseline)' },
  { value: 'avc1.4D0032', label: 'H.264 (Main)' },
  { value: 'avc1.640032', label: 'H.264 (High)' },
  { value: 'vp8', label: 'VP8' },
  { value: 'vp09.00.10.08', label: 'VP9' },
  { value: 'av01.0.05M.08', label: 'AV1' },
  { value: 'hvc1.1.6.L93.B0', label: 'HEVC (H.265)' },
]

export interface CheckVideoCodecSupportOptions {
  width?: number
  height?: number
  framerate?: number
  bitrate?: number
}

/**
 * Checks which of the given codec options are supported by the current browser
 * via the WebCodecs VideoEncoder API.
 * Returns a map of codec string → supported boolean.
 * If VideoEncoder is unavailable, returns an empty map (all treated as unknown/enabled).
 */
export async function checkVideoCodecSupport(
  codecs: readonly VideoCodecOption[],
  {
    width = 1280,
    height = 720,
    framerate = 30,
    bitrate = 5_000_000,
  }: CheckVideoCodecSupportOptions = {},
): Promise<Record<string, boolean>> {
  const encoder = (globalThis as any).VideoEncoder
  if (!encoder?.isConfigSupported) return {}

  const entries = await Promise.all(
    codecs.map(async (opt) => {
      try {
        const result = await encoder.isConfigSupported({ codec: opt.value, width, height, framerate, bitrate })
        return [opt.value, !!result?.supported] as const
      } catch {
        return [opt.value, false] as const
      }
    }),
  )

  return Object.fromEntries(entries)
}

/**
 * Merges codec options with a support map to produce options with `disabled` flag.
 * An option is disabled only when its support is explicitly `false`
 * (unknown / not yet checked = enabled).
 */
export function resolveVideoCodecOptions(
  codecs: readonly VideoCodecOption[],
  support: Record<string, boolean>,
): VideoCodecOptionResolved[] {
  return codecs.map((opt) => ({
    ...opt,
    disabled: support[opt.value] === false,
  }))
}
