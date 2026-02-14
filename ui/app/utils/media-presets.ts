import type { MediaOptimizationPreferences } from '~/stores/projects';

export type MediaOptimizationPresetKey = 'standard' | 'optimal' | 'visual-lossless' | 'lossless';

export const MEDIA_OPTIMIZATION_PRESETS: Record<
  MediaOptimizationPresetKey,
  MediaOptimizationPreferences
> = {
  standard: {
    quality: 65,
    lossless: false,
    stripMetadata: true,
    autoOrient: true,
    flatten: '',
    chromaSubsampling: '4:2:0',
  },
  optimal: {
    quality: 50,
    lossless: false,
    stripMetadata: true,
    autoOrient: true,
    flatten: '',
    chromaSubsampling: '4:2:0',
  },
  'visual-lossless': {
    quality: 90,
    lossless: false,
    stripMetadata: true,
    autoOrient: true,
    flatten: '',
    chromaSubsampling: '4:4:4',
  },
  lossless: {
    quality: 100,
    lossless: true,
    stripMetadata: true,
    autoOrient: true,
    flatten: '',
    chromaSubsampling: '4:4:4',
  },
};
