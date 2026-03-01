import { computed } from 'vue';
import { usePublicationState } from './usePublicationState';
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation';
import { getPublicationProblems } from '~/utils/publications';
import type { PublicationWithRelations } from '~/types/publications';

export function usePublicationValidation() {
  const { currentPublication } = usePublicationState();
  const { validatePostContent } = useSocialMediaValidation();

  function getEnhancedPublicationProblems(pub: PublicationWithRelations) {
    if (!pub) return [];
    const problems = getPublicationProblems(pub);
    
    // Linked platforms
    const platforms = [...new Set(pub.posts?.map(p => p.channel?.socialMedia).filter(Boolean) || [])];
    
    // Media validation for publication-level media
    if (pub.media && pub.media.length > 0) {
        const mediaCount = pub.media.length;
        const mediaArray = pub.media.map(m => ({ type: m.media?.type || 'UNKNOWN' }));
        const postType = pub.postType;
        
        let hasMediaError = false;
        for (const platform of platforms) {
            const result = validatePostContent('', mediaCount, platform as any, mediaArray, postType);
            if (!result.isValid) {
                hasMediaError = true;
                break;
            }
        }
        
        if (hasMediaError) {
            problems.push({ type: 'critical', key: 'mediaValidation' });
        }
    }
    
    return problems;
  }

  const currentPublicationPlatforms = computed<string[]>(() => {
    if (!currentPublication.value?.posts) return [];
    const platforms = currentPublication.value.posts.map(p => p.channel?.socialMedia).filter((p): p is string => Boolean(p));
    return [...new Set(platforms)];
  });

  const currentPublicationProblems = computed(() => {
    if (!currentPublication.value) return [];
    return getEnhancedPublicationProblems(currentPublication.value);
  });

  return {
    getEnhancedPublicationProblems,
    currentPublicationPlatforms,
    currentPublicationProblems
  };
}
