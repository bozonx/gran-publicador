import type { MediaOptimizationPreferences } from '~/stores/projects';

export const DEFAULT_MEDIA_OPTIMIZATION_SETTINGS: MediaOptimizationPreferences = {
  stripMetadata: true,
  autoOrient: true,
  flatten: '',
  lossless: false,
};
