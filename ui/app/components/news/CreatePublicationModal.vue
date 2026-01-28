<script setup lang="ts">
import AppModal from '~/components/ui/AppModal.vue'
import { usePageScraper } from '~/composables/usePageScraper'
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
  const aIndex = tokens[idx].attrIndex('target')
  if (aIndex < 0) {
    tokens[idx].attrPush(['target', '_blank'])
  } else {
    tokens[idx].attrs[aIndex][1] = '_blank'
  }
  return defaultRender(tokens, idx, options, env, self)
}

const props = defineProps<{
  projectId: string
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const url = defineModel<string>('url', { default: '' })

const { t } = useI18n()
const { scrapePage, isLoading, error } = usePageScraper()

const scrapedData = ref<any>(null)

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
  if (open && url.value) {
     if (!scrapedData.value || scrapedData.value.url !== url.value) {
        await fetchData(url.value)
     }
  } else if (!open) {
     // We can optional clear scrapedData here if we want to reset state every time
  }
})

async function fetchData(targetUrl: string) {
    if (!targetUrl) return
    scrapedData.value = null
    const result = await scrapePage(targetUrl, props.projectId)
    if (result) {
      scrapedData.value = result
    }
}

function handleNext() {
  // TODO: Implement later
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
      
      <div v-else-if="error" class="flex flex-col items-center justify-center py-12 text-red-500">
        <UIcon name="i-heroicons-exclamation-circle" class="w-12 h-12 mb-2" />
        <p>{{ error }}</p>
      </div>
      
      <div v-else-if="scrapedData" class="space-y-6">
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
                      <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3 shrink-0" />
                    </a>
                    
                    <span v-if="scrapedData.author" class="flex items-center gap-1.5">
                        <UIcon name="i-heroicons-user" class="w-4 h-4 shrink-0" />
                        <span class="truncate">{{ scrapedData.author }}</span>
                    </span>
                 </div>
             </div>
         </div>
         
         <!-- Lower section: Content with HTML markup -->
         <div v-if="scrapedData.body" class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div 
              class="content-preview prose prose-sm dark:prose-invert max-w-none"
              v-html="sanitizedContent"
            />
         </div>
      </div>
    </div>
    
    <template #footer>
      <UButton color="neutral" variant="ghost" @click="isOpen = false">
        {{ t('common.cancel') }}
      </UButton>
      <UButton color="primary" :disabled="!scrapedData" @click="handleNext">
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
