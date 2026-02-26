<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import CommonThumb from '~/components/common/Thumb.vue'
import { getMediaLinksThumbDataLoose } from '~/composables/useMedia'
import PublicationCreateForm from '~/components/publications/PublicationCreateForm.vue'

definePageMeta({
  middleware: 'auth'
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()

const contentItemId = computed(() => route.query.contentItemId as string)
const contentItem = ref<any>(null)
const isLoading = ref(true)

async function fetchContentItem() {
  if (!contentItemId.value) return
  isLoading.value = true
  try {
    contentItem.value = await api.get(`/content-library/items/${contentItemId.value}`)
  } catch (e) {
    console.error('Failed to fetch content item:', e)
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchContentItem)

const thumbData = computed(() => {
  if (!contentItem.value?.media || contentItem.value.media.length === 0) {
    return { first: null, totalCount: 0 }
  }
  const links = contentItem.value.media.map((m: any) => ({ 
    order: m.order, 
    media: m.media 
  }))
  return getMediaLinksThumbDataLoose(links)
})

function handleSuccess(publicationId: string) {
  router.push(`/publications/${publicationId}/edit`)
}

function handleCancel() {
  router.push('/content-library')
}

const prefilledMediaIds = computed(() => {
  return contentItem.value?.media?.map((m: any) => ({
    id: m.mediaId,
    hasSpoiler: m.hasSpoiler
  })) || []
})
</script>

<template>
  <div class="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
    <div class="flex items-center gap-4 mb-2">
      <UButton
        icon="i-heroicons-arrow-left"
        variant="ghost"
        color="neutral"
        @click="handleCancel"
      />
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('publication.create') }}
      </h1>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <UiLoadingSpinner size="lg" />
    </div>

    <div v-else-if="contentItem" class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <!-- Preview Column -->
      <div class="space-y-6 lg:sticky lg:top-6">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {{ t('common.preview') }}
        </h2>
        
        <div class="app-card overflow-hidden">
          <!-- Media Preview -->
          <div v-if="thumbData.first" class="aspect-video relative bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
             <CommonThumb
                :src="thumbData.first.src"
                :srcset="thumbData.first.srcset"
                :alt="thumbData.first.placeholderText"
                size="xl"
                :clickable="false"
                :is-video="thumbData.first.isVideo"
                :placeholder-icon="thumbData.first.placeholderIcon"
                :placeholder-text="thumbData.first.placeholderText"
                :show-stack="thumbData.totalCount > 1"
                :total-count="thumbData.totalCount"
                class="w-full h-full object-contain"
              />
          </div>

          <!-- Text Preview -->
          <div class="p-4 space-y-4">
            <h3 class="font-bold text-lg text-gray-900 dark:text-white" v-if="contentItem.title">
              {{ contentItem.title }}
            </h3>
            <div 
              class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed"
              v-if="contentItem.text"
            >
              {{ contentItem.text }}
            </div>
            <div v-if="contentItem.tags?.length" class="flex flex-wrap gap-2 pt-2">
              <UBadge v-for="tag in contentItem.tags" :key="tag" variant="subtle" color="neutral" size="xs">
                #{{ tag }}
              </UBadge>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Column -->
      <div class="app-card p-6">
        <PublicationCreateForm
          :prefilled-title="contentItem.title"
          :prefilled-content="contentItem.text"
          :prefilled-media-ids="prefilledMediaIds"
          :prefilled-tags="contentItem.tags"
          :prefilled-content-item-ids="[contentItem.id]"
          @success="handleSuccess"
          @cancel="handleCancel"
        />
      </div>
    </div>

    <div v-else-if="!isLoading" class="py-12 text-center">
      <p class="text-gray-500">{{ t('common.noResults') }}</p>
      <UButton class="mt-4" @click="handleCancel">{{ t('common.back') }}</UButton>
    </div>
  </div>
</template>
