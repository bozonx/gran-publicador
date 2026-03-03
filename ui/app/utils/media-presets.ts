import type { MediaOptimizationPreferences } from '~/types/projects';

export const DEFAULT_MEDIA_OPTIMIZATION_SETTINGS: MediaOptimizationPreferences = {
  stripMetadata: false,
  autoOrient: true,
  flatten: '',
  quality: 'normal',
};
