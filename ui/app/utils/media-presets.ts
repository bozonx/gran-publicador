import type { MediaOptimizationPreferences } from '~/stores/projects'

export type MediaOptimizationPresetKey = 'standard' | 'optimal' | 'visual-lossless' | 'lossless'

export const MEDIA_OPTIMIZATION_PRESETS: Record<MediaOptimizationPresetKey, MediaOptimizationPreferences> = {
  standard: {
    enabled: true,
    format: 'avif',
    quality: 65,
    maxDimension: 3840,
    lossless: false,
    stripMetadata: true,
    autoOrient: true,
    flatten: '',
    chromaSubsampling: '4:2:0',
    effort: 4
  },
  optimal: {
    enabled: true,
    format: 'avif',
    quality: 50,
    effort: 6,
    maxDimension: 3840,
    lossless: false,
    stripMetadata: true,
    autoOrient: true,
    flatten: '',
    chromaSubsampling: '4:2:0'
  },
  'visual-lossless': {
    enabled: true,
    format: 'avif',
    quality: 90,
    effort: 6,
    maxDimension: 3840,
    lossless: false,
    stripMetadata: true,
    autoOrient: true,
    flatten: '',
    chromaSubsampling: '4:4:4'
  },
  lossless: {
    enabled: true,
    format: 'avif',
    quality: 100,
    effort: 6,
    maxDimension: 3840,
    lossless: true,
    stripMetadata: true,
    autoOrient: true,
    flatten: '',
    chromaSubsampling: '4:4:4'
  }
}
