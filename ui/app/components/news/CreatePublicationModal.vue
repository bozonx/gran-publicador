<script setup lang="ts">
import AppModal from '~/components/ui/AppModal.vue'
import { usePageScraper } from '~/composables/usePageScraper'

const props = defineProps<{
  projectId: string
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const url = defineModel<string>('url', { default: '' })

const { t } = useI18n()
const { scrapePage, isLoading, error } = usePageScraper()

const scrapedData = ref<any>(null)

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
      
      <div v-else-if="scrapedData" class="space-y-4">
         <div class="flex gap-6 flex-col md:flex-row">
             <!-- Image preview if available -->
             <div v-if="scrapedData.image" class="w-full md:w-1/3 shrink-0">
                <img :src="scrapedData.image" class="w-full h-auto rounded-lg shadow-sm object-cover bg-gray-100 dark:bg-gray-800" />
             </div>
             
             <div class="flex-1 space-y-4">
                 <h3 class="text-xl font-bold text-gray-900 dark:text-white leading-tight">{{ scrapedData.title }}</h3>
                 
                 <div class="flex flex-wrap gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span v-if="scrapedData.author" class="flex items-center gap-1">
                        <UIcon name="i-heroicons-user" class="w-4 h-4" />
                        {{ scrapedData.author }}
                    </span>
                    <span v-if="scrapedData.date" class="flex items-center gap-1">
                        <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                        {{ new Date(scrapedData.date).toLocaleDateString() }}
                    </span>
                    <span v-if="scrapedData.source" class="flex items-center gap-1">
                         <UIcon name="i-heroicons-globe-alt" class="w-4 h-4" />
                         {{ scrapedData.source }}
                    </span>
                 </div>
                 
                 <p class="text-gray-700 dark:text-gray-300">{{ scrapedData.description }}</p>
                 
                 <!-- Raw JSON preview for debugging/verification as requested "show result" -->
                 <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs font-mono overflow-auto max-h-60 border border-gray-200 dark:border-gray-700">
                   <pre>{{ JSON.stringify(scrapedData, null, 2) }}</pre>
                 </div>
             </div>
         </div>
         
         <div v-if="scrapedData.body" class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Content Preview</h4>
            <div class="prose dark:prose-invert max-w-none text-sm line-clamp-6">
                {{ scrapedData.body }}
            </div>
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
