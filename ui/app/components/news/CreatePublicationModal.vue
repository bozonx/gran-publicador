<script setup lang="ts">
import { nextTick } from 'vue'
import AppModal from '~/components/ui/AppModal.vue'
import { useNews } from '~/composables/useNews'
import { usePublications } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import type { NewsItem } from '~/composables/useNews'
import DOMPurify from 'isomorphic-dompurify'
import { marked, type Tokens } from 'marked'

// Configure marked with GFM and target="_blank" on links
const renderer = new marked.Renderer()
const originalLinkRenderer = renderer.link.bind(renderer)
renderer.link = function (token: Tokens.Link) {
  const html = originalLinkRenderer(token)
  return html.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ')
}

marked.setOptions({
  gfm: true,
  breaks: false,
  renderer,
})

const props = defineProps<{
  projectId?: string
  sourceNewsItem?: NewsItem
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const url = defineModel<string>('url', { default: '' })

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { fetchNewsContent, isLoading: isNewsLoading } = useNews()
const { createPublication } = usePublications()
const { projects, fetchProjects } = useProjects()
const { user } = useAuth()

const isGeneralNewsPage = computed(() => route.path === '/news')
const selectedProjectId = ref<string | null>(null)
const isCreating = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)

const extraProjectOptions = computed(() => [])

const selectedProject = computed(() => {
  if (!selectedProjectId.value) return null
  return projects.value.find(p => p.id === selectedProjectId.value) || null
})

onMounted(async () => {
  if (projects.value.length === 0) {
    await fetchProjects()
  }
})

const scrapedData = ref<any>(null)
const isUsingFallback = ref(false)

// Sanitized HTML content for safe rendering
const sanitizedContent = computed(() => {
  if (!scrapedData.value?.body) return ''
  
  // 1. Render markdown to HTML. 
  // We allow HTML in the MD so that we can then strip it.
  const html = marked.parse(scrapedData.value.body) as string
  
  // 2. Sanitize resulting HTML.
  // We ONLY allow tags that are safe and expected from Markdown.
  // Any other tags (like <div>, <span>, etc. from raw HTML in MD) will be stripped.
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'u', 's', 'del', 'ins', 'sub', 'sup', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'title']
  })
})

// Format date helper
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  } catch {
    return dateString
  }
}

// Get hostname from URL
function getHostname(urlString: string): string {
  try {
    return new URL(urlString).hostname
  } catch {
    return urlString
  }
}

// Reset when opening with new URL
watch(() => url.value, async (newUrl) => {
  if (newUrl && isOpen.value) {
    await fetchData(newUrl)
  }
})

const step = ref(1)

// Also watch isOpen, in case URL was set before opening
watch(isOpen, async (open) => {
  if (open) {
    step.value = 1
    console.log('Modal opened with props:', { 
      url: url.value, 
      sourceNewsItem: props.sourceNewsItem,
      projectId: props.projectId 
    })
    
    // Ensure projects are loaded
    if (projects.value.length === 0) {
      await fetchProjects()
    }
    
    if (isGeneralNewsPage.value) {
      selectedProjectId.value = null
    } else {
      selectedProjectId.value = props.projectId || null
    }
    // Only fetch if we have a news item. Arbitrary URLs not supported anymore as per news service changes.
    if (props.sourceNewsItem) {
        if (!scrapedData.value || scrapedData.value.url !== props.sourceNewsItem.url) {
           await fetchData(props.sourceNewsItem.url)
        }
    } else if (url.value) {
        // Fallback for arbitrary URLs (should not happen in main flow if button hidden, but direct open?)
        // Just show warning or use basic info if we can't scrape
        error.value = 'Scraping arbitrary URLs is not supported. Please select a news item.'
        isUsingFallback.value = true
    }
  } else if (!open) {
     // We can optional clear scrapedData here if we want to reset state every time
  }
})

async function fetchData(targetUrl: string) {
    if (!props.sourceNewsItem) return
    
    scrapedData.value = null
    isUsingFallback.value = false
    isLoading.value = true
    error.value = null
    
    console.log('fetchData called for news:', { id: props.sourceNewsItem.id })
    
    // We use the initial projectId for scraping as it usually has the context of the search
    const scrapeProjectId = props.projectId || selectedProjectId.value
    
    try {
        if (!scrapeProjectId) {
           // If no project context, try finding first or use what? 
           // Fetching content requires project context for permissions mostly.
           // Maybe we can use any project user has access to, or just force project selection?
           const firstProject = projects.value[0]?.id
           if (firstProject) {
              const localeCode = props.sourceNewsItem?.locale || user.value?.language || locale.value
              const res = await fetchNewsContent(props.sourceNewsItem, firstProject, false, localeCode)
              if (res) scrapedData.value = res
           } else {
              error.value = 'No project available to fetch content context'
           }
        } else {
           const localeCode = props.sourceNewsItem?.locale || user.value?.language || locale.value
           const res = await fetchNewsContent(props.sourceNewsItem, scrapeProjectId, false, localeCode)
           if (res) scrapedData.value = res
        }
    } catch (err: any) {
        console.error('Failed to fetch content', err)
        error.value = t('publication.scrapeFailed')
    } finally {
        isLoading.value = false
    }

    // Wait for Vue reactivity to update
    await nextTick()

    // If scraping failed but we have news item, automatically fall back
    if (!scrapedData.value && props.sourceNewsItem) {
      console.log('Fetch failed or no content, using fallback data from news item')
      handleUseNewsData(false) // Don't clear error if it was a real error
      isUsingFallback.value = true
    }
}

async function handleNext() {
  if (!scrapedData.value) return
  
  if (step.value === 1 && isGeneralNewsPage.value) {
    step.value = 2
    return
  }

  if (!selectedProjectId.value) {
    toast.add({ title: t('common.error'), description: t('publication.validation.projectRequired', 'Please select a project'), color: 'error' })
    return
  }

  isCreating.value = true
  
  try {
    const sd = scrapedData.value
    
    // Just use the body text for content to avoid title duplication when templates are used
    const body = sd.body || ''
    
    // Get language from scraped data or user preferences or fallback to 'en-US'
    const lang = sd.meta?.lang || user.value?.language || locale.value
    
    // Use sourceNewsItem if available for richer metadata
    const sourceData = props.sourceNewsItem || sd
    
    // Create publication with all available news info
    const publication = await createPublication({
      projectId: selectedProjectId.value,
      postType: 'NEWS' as any,
      newsItemId: props.sourceNewsItem?.id || sd.id,
      title: sd.title || undefined,
      description: sd.description || undefined,
      postDate: sd.date ? new Date(sd.date).toISOString() : undefined,
      language: lang,
      imageUrl: sd.image || undefined,
      content: body,
      tags: sourceData.tags || sd.tags || undefined,
      meta: {
        newsData: {
          url: sd.url || sourceData.url,
          source: sd.source || sourceData.source,
          taskId: (sourceData as any).taskId,
          batchId: (sourceData as any).batchId
        }
      }
    })
    
    if (publication) {
      // Check if image was requested but missing in created publication (failed upload)

      if (sd.image && (!publication.media || !publication.media.some((m: any) => m.media?.type === 'IMAGE'))) {
         console.warn('[CreatePublicationModal] Image upload failed detected:', { 
           requested: sd.image, 
           actualMedia: publication.media,
           publicationId: publication.id
         })
         toast.add({
            title: t('common.error'),
            description: t('publication.imageUploadFailed') || 'Image could not be uploaded, publication created without it.',
            color: 'error',
            duration: 10000,
         })
      }


      // Close modal
      isOpen.value = false
      
      // Navigate to edit page with openLlm query parameter
      await router.push(`/publications/${publication.id}/edit?openLlm=true`)
    }
  } catch (err: any) {
    console.error('Failed to create publication from news:', err)
    toast.add({
      title: t('common.error'),
      description: t('publication.createError'),
      color: 'error'
    })
  } finally {
    isCreating.value = false
  }
}

function handleUseNewsData(clearError = true) {
  console.log('handleUseNewsData called', { sourceNewsItem: props.sourceNewsItem, clearError })
  
  if (!props.sourceNewsItem) {
    console.warn('No sourceNewsItem available for fallback!')
    return
  }
  
  // Populate scrapedData from news card
  scrapedData.value = {
    url: props.sourceNewsItem.url,
    title: props.sourceNewsItem.title,
    description: props.sourceNewsItem.description,
    body: props.sourceNewsItem.description || '', // Use description as body
    date: props.sourceNewsItem.date || props.sourceNewsItem.savedAt,
    image: props.sourceNewsItem.mainImageUrl || props.sourceNewsItem.mainVideoUrl || '',
    source: props.sourceNewsItem.source,
    author: '', // Not usually in card
    meta: {
       lang: props.sourceNewsItem.locale
    }
  }
  
  console.log('scrapedData populated from news item:', scrapedData.value)
  
  if (clearError) {
    error.value = null
    isUsingFallback.value = false
  }
}

</script>

<template>
  <AppModal
    v-model:open="isOpen"
    :title="t('publication.create')"
    class="w-full max-w-4xl"
    :prevent-close="isCreating"
    :close-button="!isCreating"
  >
    <div class="space-y-6 min-h-[300px] relative">
      <!-- Loading news content spinner -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-12 h-full">
         <UiLoadingSpinner size="xl" color="primary" :label="t('common.loading')" centered />
      </div>

      <!-- Creating publication spinner (overlay) -->
      <div v-if="isCreating" class="absolute inset-x-0 inset-y-[-24px] z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-xs rounded-2xl">
         <UiLoadingSpinner size="xl" color="primary" :label="t('common.saving')" centered />
      </div>
      
      <div v-else-if="!isLoading" class="space-y-6">
        <!-- Error Banner -->
        <div v-if="error" class="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex items-start gap-3">
           <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 shrink-0 mt-0.5" />
           <div class="space-y-2 text-sm flex-1">
             <p class="font-bold flex items-center gap-2">
               {{ t('publication.scrapeFailed') === 'publication.scrapeFailed' ? 'Automatic page detection failed' : t('publication.scrapeFailed') }}
               <span v-if="isUsingFallback" class="text-xs font-normal opacity-70 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                 Fallback Mode
               </span>
             </p>
             <p class="opacity-80 font-mono text-[11px] leading-tight break-all">{{ error }}</p>
             <p v-if="isUsingFallback" class="pt-1 font-medium italic opacity-90">
               We are using available data from the news card instead. You can still proceed.
             </p>
             <!-- Manual fallback button if auto-fallback didn't work -->
             <div v-else-if="props.sourceNewsItem && !scrapedData" class="pt-2">
               <UButton 
                 size="xs"
                 color="primary"
                 variant="soft"
                 icon="i-heroicons-arrow-path"
                 @click="handleUseNewsData(true)"
               >
                 Use News Card Data
               </UButton>
             </div>
           </div>
        </div>

        <!-- Success Content / Fallback Data -->
        <div v-if="scrapedData && step === 1" class="space-y-6">

           <!-- Premium News Preview Card -->
           <div class="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <!-- Header Image -->
              <div v-if="scrapedData.image" class="relative w-full aspect-video md:aspect-21/9 overflow-hidden">
                 <img 
                   :src="scrapedData.image" 
                   :alt="scrapedData.title"
                   class="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                 />
                 <div class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-60"></div>

                 
                 <div class="absolute bottom-4 left-6 right-6">
                    <UBadge v-if="scrapedData.source || scrapedData.url" variant="solid" color="primary" size="sm" class="mb-2">
                       {{ scrapedData.source || getHostname(scrapedData.url) }}
                    </UBadge>
                 </div>
              </div>

              <div class="p-6 space-y-4">
                 <!-- Metadata Row -->
                 <div class="flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <span v-if="scrapedData.date" class="flex items-center gap-1.5">
                        <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                        {{ formatDate(scrapedData.date) }}
                    </span>
                    
                    <span v-if="scrapedData.author" class="flex items-center gap-1.5">
                        <UIcon name="i-heroicons-user" class="w-4 h-4" />
                        {{ scrapedData.author }}
                    </span>

                    <span v-if="scrapedData.url" class="flex items-center gap-1.5 ml-auto">
                        <a 
                          :href="scrapedData.url" 
                          target="_blank"
                          rel="noopener noreferrer"
                          class="hover:text-primary-500 transition-colors flex items-center gap-1"
                        >
                          <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-4 h-4" />
                          {{ t('news.viewOriginal') || 'Original' }}
                        </a>
                    </span>
                 </div>

                 <!-- Title -->
                 <h3 class="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">
                    {{ scrapedData.title }}
                 </h3>

                 <!-- Content/Body Section -->
                 <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
                    <!-- Plain text description when in fallback mode -->
                    <div v-if="isUsingFallback" class="text-gray-600 dark:text-gray-400 text-base leading-relaxed whitespace-pre-wrap">
                       {{ scrapedData.description }}
                    </div>
                    
                    <!-- Rich text content preview -->
                    <div 
                      v-else-if="scrapedData.body"
                      class="content-preview prose prose-neutral dark:prose-invert max-w-none prose-img:rounded-xl prose-a:text-primary-500"
                      v-html="sanitizedContent"
                    />
                    
                    <div v-else class="text-gray-400 italic text-sm text-center py-4">
                       {{ t('publication.noContent') || 'No content available for preview' }}
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <!-- Step 2: Project Selection -->
        <div v-if="step === 2" class="space-y-8 py-4">
          <div class="space-y-2">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ t('publication.select_project') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('publication.select_project_description') || 'Выберите проект, в котором будет создана публикация' }}
            </p>
          </div>

          <div class="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
            <UFormField :label="t('publication.project')">
              <CommonProjectSelect
                v-model="selectedProjectId"
                :extra-options="extraProjectOptions"
                class="w-full"
                :placeholder="t('publication.select_project')"
              />
            </UFormField>

            <div v-if="selectedProject" class="mt-6 flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
              <div class="w-12 h-12 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
                <UIcon name="i-heroicons-briefcase" class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 dark:text-white truncate">{{ selectedProject.name }}</p>
                <p v-if="selectedProject.note" class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ selectedProject.note }}</p>
              </div>
            </div>
            <div v-else class="mt-6 flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 opacity-60">
              <div class="w-12 h-12 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                <UIcon name="i-heroicons-briefcase" class="w-6 h-6" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 dark:text-white">{{ t('publication.select_project') }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('publication.select_project_description') || 'Выберите проект, в котором будет создана публикация' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- No data found anywhere state -->
        <div v-else-if="!isLoading && !error" class="flex flex-col items-center justify-center py-12 text-gray-500">
           <UIcon name="i-heroicons-document-search" class="w-12 h-12 mb-2 opacity-20" />
           <p>No content available to preview.</p>
        </div>
      </div>
    </div>
    
    <template #footer>
      <UButton color="neutral" variant="ghost" @click="isOpen = false">
        {{ t('common.cancel') }}
      </UButton>
      
      <div class="flex-1"></div>

      <UButton 
        v-if="step === 2" 
        color="neutral" 
        variant="soft" 
        @click="step = 1"
        :disabled="isCreating"
      >
        {{ t('common.back') }}
      </UButton>

      <UButton 
        color="primary" 
        :disabled="!scrapedData" 
        :loading="isCreating" 
        @click="handleNext"
      >
        {{ step === 1 && isGeneralNewsPage ? t('common.next') : (isCreating ? t('common.creating') : t('common.create')) }}
      </UButton>
    </template>
  </AppModal>
</template>

<style scoped>
.content-preview :deep(a) {
  color: #3b82f6; /* primary-500 */
  text-decoration: underline;
  text-underline-offset: 2px;
}

.content-preview :deep(a:hover) {
  color: #2563eb; /* primary-600 */
}

.content-preview :deep(p) {
  margin-bottom: 1.25rem;
  line-height: 1.6;
}

.content-preview :deep(h1), 
.content-preview :deep(h2), 
.content-preview :deep(h3) {
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  line-height: 1.25;
}

.wrap-break-word {
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
}
</style>
