<script setup lang="ts">
import { nextTick } from 'vue'
import AppModal from '~/components/ui/AppModal.vue'
import { useNews } from '~/composables/useNews'
import { usePublications } from '~/composables/usePublications'
import { useProjects } from '~/composables/useProjects'
import type { NewsItem } from '~/composables/useNews'
import DOMPurify from 'isomorphic-dompurify'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: true, // Allow HTML so we can strip it with DOMPurify
  linkify: true,
  typographer: true
})

// Add target="_blank" to external links
const defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
  return self.renderToken(tokens, idx, options)
}
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  if (token) {
    const aIndex = token.attrIndex('target')
    if (aIndex < 0) {
      token.attrPush(['target', '_blank'])
    } else if (token.attrs && token.attrs[aIndex]) {
      const attr = token.attrs[aIndex]
      if (attr) attr[1] = '_blank'
    }
  }
  return defaultRender(tokens, idx, options, env, self)
}

const props = defineProps<{
  projectId?: string
  sourceNewsItem?: NewsItem
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const url = defineModel<string>('url', { default: '' })

const { t } = useI18n()
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

const projectOptions = computed(() => [
  { value: null, label: t('publication.personal_draft') },
  ...projects.value.map(p => ({ value: p.id, label: p.name }))
])

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
  const html = md.render(scrapedData.value.body)
  
  // 2. Sanitize resulting HTML.
  // We ONLY allow tags that are safe and expected from Markdown.
  // Any other tags (like <div>, <span>, etc. from raw HTML in MD) will be stripped.
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre'],
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

// Also watch isOpen, in case URL was set before opening
watch(isOpen, async (open) => {
  if (open) {
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
              const res = await fetchNewsContent(props.sourceNewsItem, firstProject)
              if (res) scrapedData.value = res
           } else {
              error.value = 'No project available to fetch content context'
           }
        } else {
           const res = await fetchNewsContent(props.sourceNewsItem, scrapeProjectId)
           if (res) scrapedData.value = res
        }
    } catch (err: any) {
        console.error('Failed to fetch content', err)
        error.value = err.message || 'Failed to fetch content'
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
  
  isCreating.value = true
  
  try {
    const sd = scrapedData.value
    
    // Format news content as Markdown with h1 title
    const title = sd.title || ''
    const body = sd.body || ''
    const sourceTextContent = `# ${title}\n\n${body}`
    
    // Get language from scraped data or user preferences or fallback to 'en-US'
    let lang = sd.meta?.lang || user.value?.language || 'en-US'
    
    // Prepare metadata: remove fields we use directly to avoid duplication
    // Use sourceNewsItem if available for richer metadata
    const sourceData = props.sourceNewsItem || sd
    const otherData: any = { ...sourceData }
    
    // User requested to NOT save title and description in the card data
    delete otherData.title
    delete otherData.description
    
    // Clean up other fields that might have been mapped or are not needed in meta
    delete otherData.body
    delete otherData.date
    delete otherData.url
    
    // Also clean up meta nested object if coming from scraped data
    if (otherData.meta) {
      otherData.meta = { ...otherData.meta }
      delete otherData.meta.lang
      if (Object.keys(otherData.meta).length === 0) delete otherData.meta
    }
    
    // Create publication with all available news info
    const publication = await createPublication({
      projectId: selectedProjectId.value || undefined,
      postType: 'NEWS',
      newsItemId: props.sourceNewsItem?.id,
      title: sd.title || undefined,
      description: sd.description || undefined,
      postDate: sd.date ? new Date(sd.date).toISOString() : undefined,
      language: lang,
      imageUrl: sd.image || undefined,
      meta: {
        newsData: otherData
      },
      sourceTexts: [
        {
          content: sourceTextContent,
          order: 0,
          source: sd.url
        }
      ]
    })
    
    if (publication) {
      // Check if image was requested but missing in created publication (failed upload)
      if (sd.image && (!publication.media || !publication.media.some((m: any) => m.media?.type === 'IMAGE'))) {
         toast.add({
            title: t('common.warning'),
            description: t('publication.imageUploadFailed') || 'Image could not be uploaded, publication created without it.',
            color: 'warning',
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
      description: err.message || t('publication.createError'),
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
  >
    <div class="space-y-6 min-h-[300px]">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-12 h-full">
         <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 text-primary-500 animate-spin mb-4" />
         <p class="text-gray-500">{{ t('common.loading') }}</p>
      </div>
      
      <div v-else class="space-y-6">
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
        <div v-if="scrapedData" class="space-y-6">
           <!-- Project selection (only on general news page) -->
           <UFormField v-if="isGeneralNewsPage" :label="t('publication.select_project')">
              <USelectMenu
                v-model="selectedProjectId"
                :items="projectOptions"
                value-key="value"
                label-key="label"
                class="w-full"
                :placeholder="t('publication.select_project')"
              >
                <template #leading>
                  <UIcon :name="selectedProjectId ? 'i-heroicons-briefcase' : 'i-heroicons-user'" class="w-4 h-4 text-gray-400" />
                </template>
              </USelectMenu>
           </UFormField>

           <!-- Upper section: Image + Metadata -->
           <div class="flex gap-4">
               <!-- Image on the left -->
               <div v-if="scrapedData.image" class="shrink-0">
                  <img 
                    :src="scrapedData.image" 
                    :alt="scrapedData.title"
                    class="w-32 h-32 rounded-lg object-cover bg-gray-100 dark:bg-gray-800 shadow-sm" 
                  />
               </div>
               
               <!-- Metadata on the right -->
               <div class="flex-1 min-w-0 space-y-2">
                   <!-- Title with text wrapping -->
                   <h3 class="text-xl font-bold text-gray-900 dark:text-white leading-tight wrap-break-word">
                     {{ scrapedData.title }}
                   </h3>
                   
                   <!-- Date, Source, Author -->
                   <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                      <span v-if="scrapedData.date" class="flex items-center gap-1.5">
                          <UIcon name="i-heroicons-calendar" class="w-4 h-4 shrink-0" />
                          <time :datetime="scrapedData.date">
                            {{ formatDate(scrapedData.date) }}
                          </time>
                      </span>
                      
                      <a 
                        v-if="scrapedData.url" 
                        :href="scrapedData.url" 
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        <UIcon name="i-heroicons-globe-alt" class="w-4 h-4 shrink-0" />
                        <span class="truncate">{{ scrapedData.source || getHostname(scrapedData.url) }}</span>
                      </a>
                      
                      <span v-if="scrapedData.author" class="flex items-center gap-1.5">
                          <UIcon name="i-heroicons-user" class="w-4 h-4 shrink-0" />
                          <span class="truncate">{{ scrapedData.author }}</span>
                      </span>
                   </div>

                   <!-- Description as plain text when in fallback/error mode -->
                   <div v-if="isUsingFallback" class="pt-2">
                      <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed line-clamp-4">
                        {{ scrapedData.description }}
                      </p>
                   </div>
               </div>
           </div>
           
           <!-- Lower section: Content with HTML markup (hidden in fallback mode as requested) -->
           <div v-if="scrapedData.body && !isUsingFallback" class="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div 
                class="content-preview prose prose-sm dark:prose-invert max-w-none"
                v-html="sanitizedContent"
              />
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
      <UButton color="primary" :disabled="!scrapedData" :loading="isCreating" @click="handleNext">
        {{ t('common.next') }}
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
