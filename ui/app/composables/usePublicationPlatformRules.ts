import { computed, watch, type Ref } from 'vue'
import { getPostTypeOptionsForPlatforms } from '~/utils/socialMediaPlatforms'
import { SOCIAL_MEDIA_PLATFORMS } from '@gran/shared/social-media-platforms'
import { isTextContentEmpty } from '~/utils/text'
import { usePublicationValidator } from '~/composables/usePublicationValidator'
import type { PublicationWithRelations } from '~/composables/usePublications'

export interface UsePublicationPlatformRulesOptions {
  isEditMode: Ref<boolean>
  state: any
  channels: Ref<any[]>
  publication: Ref<PublicationWithRelations | null | undefined>
  t: (key: string) => string
}

export function usePublicationPlatformRules(options: UsePublicationPlatformRulesOptions) {
  const { isEditMode, state, channels, publication, t } = options
  const { validateForChannels, validateForExistingPosts } = usePublicationValidator()

  const selectedPlatforms = computed(() => {
    const map = new Map(channels.value.map(ch => [ch.id, ch.socialMedia]))
    return state.channelIds.map((id: string) => map.get(id)).filter(Boolean) as any[]
  })

  const postTypeOptions = computed(() => {
    return getPostTypeOptionsForPlatforms({
      t,
      platforms: selectedPlatforms.value,
    })
  })

  const tagLimits = computed(() => {
    if (!selectedPlatforms.value || selectedPlatforms.value.length === 0) return null

    let maxCount = Infinity
    let recommendedCount = Infinity

    for (const p of selectedPlatforms.value) {
      const pConfig = SOCIAL_MEDIA_PLATFORMS[p as keyof typeof SOCIAL_MEDIA_PLATFORMS]
      if (pConfig?.tags?.supported) {
        if (pConfig.tags.maxCount < maxCount) maxCount = pConfig.tags.maxCount
        if (pConfig.tags.recommendedCount < recommendedCount) recommendedCount = pConfig.tags.recommendedCount
      }
    }

    return {
      maxCount: maxCount === Infinity ? undefined : maxCount,
      recommendedCount: recommendedCount === Infinity ? undefined : recommendedCount,
    }
  })

  // Automatically select the first supported postType if none is selected (for new publications)
  watch(postTypeOptions, (options) => {
    const firstOption = options[0]
    if (!isEditMode.value && firstOption && !state.postType) {
      state.postType = firstOption.value as any
    }
  }, { immediate: true })

  const hasMedia = computed(() => Array.isArray(publication.value?.media) && publication.value!.media.length > 0)
  
  const isContentMissing = computed(() => {
    // Only show content/media requirement for non-DRAFT statuses
    if (state.status === 'DRAFT') return false
    return isTextContentEmpty(state.content) && !hasMedia.value
  })

  // Social Media Validation
  const validationErrors = computed(() => {
    const pub = publication.value
    const mediaCount = pub?.media?.length || 0
    const mediaArray = pub?.media?.map(m => ({ type: m.media?.type || 'UNKNOWN' })) || []
    const postType = state.postType

    let errors: any[]
    
    if (!isEditMode.value) {
      const channelMap = Object.fromEntries(
        channels.value.map(ch => [ch.id, { name: ch.name, socialMedia: ch.socialMedia }])
      )
      // Creating: validate for selected channels
      errors = validateForChannels(
        state.content,
        mediaCount,
        mediaArray,
        postType,
        state.channelIds,
        [],
        channelMap,
        state.tags,
      )
    } else {
      // Editing: validate for existing posts that inherit content
      errors = validateForExistingPosts(
        state.content,
        mediaCount,
        mediaArray,
        postType,
        pub as any,
        state.tags,
      )
    }

    return errors
      .filter(e => e.message?.trim())
      .map(e => `${e.channel}: ${e.message}`)
  })

  const isValid = computed(() => validationErrors.value.length === 0)

  return {
    selectedPlatforms,
    postTypeOptions,
    tagLimits,
    hasMedia,
    isContentMissing,
    validationErrors,
    isValid,
  }
}
