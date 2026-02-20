import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BASE_VIDEO_CODEC_OPTIONS,
  checkVideoCodecSupport,
  resolveVideoCodecOptions,
} from '../../app/utils/webcodecs'

describe('resolveVideoCodecOptions', () => {
  it('marks nothing as disabled when support map is empty', () => {
    const result = resolveVideoCodecOptions(BASE_VIDEO_CODEC_OPTIONS, {})
    expect(result.every((o) => o.disabled === false)).toBe(true)
  })

  it('marks codec as disabled when support is explicitly false', () => {
    const support = { 'avc1.42E032': false }
    const result = resolveVideoCodecOptions(BASE_VIDEO_CODEC_OPTIONS, support)
    const baseline = result.find((o) => o.value === 'avc1.42E032')
    expect(baseline?.disabled).toBe(true)
  })

  it('does not disable codec when support is true', () => {
    const support = { 'avc1.42E032': true }
    const result = resolveVideoCodecOptions(BASE_VIDEO_CODEC_OPTIONS, support)
    const baseline = result.find((o) => o.value === 'avc1.42E032')
    expect(baseline?.disabled).toBe(false)
  })

  it('does not disable codec when support is unknown (key absent)', () => {
    const result = resolveVideoCodecOptions(BASE_VIDEO_CODEC_OPTIONS, { vp8: true })
    const av1 = result.find((o) => o.value === 'av01.0.05M.08')
    expect(av1?.disabled).toBe(false)
  })

  it('preserves label and value from source options', () => {
    const result = resolveVideoCodecOptions(BASE_VIDEO_CODEC_OPTIONS, {})
    const vp9 = result.find((o) => o.value === 'vp09.00.10.08')
    expect(vp9?.label).toBe('VP9')
  })

  it('returns the same number of options as input', () => {
    const result = resolveVideoCodecOptions(BASE_VIDEO_CODEC_OPTIONS, {})
    expect(result).toHaveLength(BASE_VIDEO_CODEC_OPTIONS.length)
  })
})

describe('checkVideoCodecSupport', () => {
  afterEach(() => {
    delete (globalThis as any).VideoEncoder
  })

  it('returns empty map when VideoEncoder is not available', async () => {
    delete (globalThis as any).VideoEncoder
    const result = await checkVideoCodecSupport(BASE_VIDEO_CODEC_OPTIONS)
    expect(result).toEqual({})
  })

  it('returns empty map when VideoEncoder.isConfigSupported is absent', async () => {
    ;(globalThis as any).VideoEncoder = {}
    const result = await checkVideoCodecSupport(BASE_VIDEO_CODEC_OPTIONS)
    expect(result).toEqual({})
  })

  it('returns true for codecs reported as supported', async () => {
    ;(globalThis as any).VideoEncoder = {
      isConfigSupported: vi.fn().mockResolvedValue({ supported: true }),
    }
    const result = await checkVideoCodecSupport([{ value: 'avc1.42E032', label: 'H.264 (Baseline)' }])
    expect(result['avc1.42E032']).toBe(true)
  })

  it('returns false for codecs reported as not supported', async () => {
    ;(globalThis as any).VideoEncoder = {
      isConfigSupported: vi.fn().mockResolvedValue({ supported: false }),
    }
    const result = await checkVideoCodecSupport([{ value: 'hvc1.1.6.L93.B0', label: 'HEVC (H.265)' }])
    expect(result['hvc1.1.6.L93.B0']).toBe(false)
  })

  it('returns false when isConfigSupported throws', async () => {
    ;(globalThis as any).VideoEncoder = {
      isConfigSupported: vi.fn().mockRejectedValue(new Error('unsupported')),
    }
    const result = await checkVideoCodecSupport([{ value: 'av01.0.05M.08', label: 'AV1' }])
    expect(result['av01.0.05M.08']).toBe(false)
  })

  it('passes correct config to isConfigSupported', async () => {
    const isConfigSupported = vi.fn().mockResolvedValue({ supported: true })
    ;(globalThis as any).VideoEncoder = { isConfigSupported }
    await checkVideoCodecSupport([{ value: 'vp8', label: 'VP8' }], {
      width: 1920,
      height: 1080,
      framerate: 60,
      bitrate: 8_000_000,
    })
    expect(isConfigSupported).toHaveBeenCalledWith({
      codec: 'vp8',
      width: 1920,
      height: 1080,
      framerate: 60,
      bitrate: 8_000_000,
    })
  })

  it('checks all codecs in BASE_VIDEO_CODEC_OPTIONS', async () => {
    const isConfigSupported = vi.fn().mockResolvedValue({ supported: true })
    ;(globalThis as any).VideoEncoder = { isConfigSupported }
    const result = await checkVideoCodecSupport(BASE_VIDEO_CODEC_OPTIONS)
    expect(Object.keys(result)).toHaveLength(BASE_VIDEO_CODEC_OPTIONS.length)
    expect(isConfigSupported).toHaveBeenCalledTimes(BASE_VIDEO_CODEC_OPTIONS.length)
  })
})
