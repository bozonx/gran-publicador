<script setup lang="ts">
import ContentItemCard from '~/components/content/ContentItemCard.vue'

const { t } = useI18n()
const api = useApi()
const router = useRouter()

const items = ref<any[]>([])
const isLoading = ref(false)

async function fetchRecentContent() {
  isLoading.value = true
  try {
    const res = await api.get<any>('/content-library/items', {
      params: {
        scope: 'personal',
        limit: 10,
        offset: 0,
      },
    })
    items.value = res.items
  } catch (error) {
    console.error('Failed to fetch recent content:', error)
  } finally {
    isLoading.value = false
  }
}

function handleCardClick(item: any) {
  // Navigate to personal content library with search or id focus if supported
  // For now just navigate to content library
  router.push('/content-library')
}

onMounted(() => {
  fetchRecentContent()
})
</script>

<template>
  <div v-if="items.length > 0 || isLoading" class="space-y-4">
    <div class="flex items-center justify-between px-1">
      <h3 class="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2">
        <UIcon name="i-heroicons-square-3-stack-3d" class="w-4 h-4" />
        {{ t('dashboard.recent_content', 'Recent content') }}
      </h3>
      <UButton
        to="/content-library"
        variant="ghost"
        size="xs"
        color="primary"
        icon="i-heroicons-arrow-right"
        trailing
      >
        {{ t('common.viewAll') }}
      </UButton>
    </div>

    <div class="relative overflow-hidden">
      <!-- Horizontal scroll container -->
      <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
        <div 
          v-if="isLoading && items.length === 0" 
          v-for="i in 5" 
          :key="i"
          class="min-w-[280px] w-[280px] h-[320px] bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"
        ></div>
        
        <div 
          v-for="item in items" 
          :key="item.id"
          class="min-w-[280px] w-[280px] flex-shrink-0 h-full"
        >
          <ContentItemCard
            :item="item"
            hide-checkbox
            hide-actions
            class="!h-full shadow-sm"
            @click="handleCardClick"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
