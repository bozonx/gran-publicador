<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'

interface Props {
  publications: PublicationWithRelations[]
  totalCount: number
  loading: boolean
  viewAllTo: string
  showProjectInfo?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showProjectInfo: false,
})

const { t } = useI18n()
const router = useRouter()

function goToPublication(pub: PublicationWithRelations) {
  router.push(`/publications/${pub.id}`)
}
</script>

<template>
  <div v-if="totalCount > 0 || loading" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-gray-400" />
        {{ t('publicationStatus.draft') }}
        <CommonCountBadge :count="totalCount" :title="t('publicationStatus.draft')" />
      </h2>
      <UButton
        v-if="totalCount > 0"
        variant="ghost"
        color="neutral"
        size="sm"
        icon="i-heroicons-arrow-right"
        trailing
        :to="viewAllTo"
      >
        {{ t('common.viewAll') }}
      </UButton>
    </div>

    <div v-if="loading && !publications.length" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-gray-400 animate-spin" />
    </div>
    
    <CommonHorizontalScroll v-else-if="publications.length > 0">
      <PublicationsPublicationCard
        v-for="draft in publications"
        :key="draft.id"
        :publication="draft"
        :show-project-info="showProjectInfo"
        class="w-64 shrink-0 transition-transform duration-200 hover:scale-[1.02]"
        @click="goToPublication"
      />
      <CommonViewAllCard
        v-if="totalCount > 5"
        :to="viewAllTo"
      />
    </CommonHorizontalScroll>
    
    <div v-else class="text-center py-8 text-sm text-gray-500">
      {{ t('publication.noPublicationsDescription') }}
    </div>
  </div>
</template>
