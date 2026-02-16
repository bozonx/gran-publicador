<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'

interface Props {
  publications: PublicationWithRelations[]
  totalCount: number
  loading: boolean
  viewAllTo: string
  showProjectInfo?: boolean
  // If provided, controls the title. If not, dynamic title based on activeCollection is used.
  title?: string 
  // 'DRAFT' or 'READY'
  activeCollection?: string 
  showToggle?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showProjectInfo: false,
  title: '',
  activeCollection: 'DRAFT',
  showToggle: true
})

const emit = defineEmits<{
  (e: 'delete', publication: PublicationWithRelations): void
  (e: 'update:activeCollection', collection: string): void
}>()

const { t } = useI18n()
const router = useRouter()

function goToPublication(pub: PublicationWithRelations) {
  router.push(`/publications/${pub.id}`)
}

const isDraft = computed(() => props.activeCollection === 'DRAFT')

const displayTitle = computed(() => {
  if (props.title) return props.title
  return isDraft.value ? t('publicationStatus.draft') : t('publicationStatus.ready')
})
</script>

<template>
  <div class="app-card p-6">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-4">
        <!-- Toggle for Drafts/Ready -->
        <CommonViewToggle
            v-if="showToggle"
            :model-value="activeCollection"
            :options="[
                { value: 'DRAFT', label: t('publicationStatus.draft') },
                { value: 'READY', label: t('publicationStatus.ready') }
            ]"
            @update:model-value="emit('update:activeCollection', $event)"
        />

        <div class="flex items-center gap-2">
            <CommonCountBadge :count="totalCount" :title="displayTitle" />
        </div>
      </div>

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
      <UiLoadingSpinner />
    </div>
    
    <CommonHorizontalScroll v-else-if="publications.length > 0">
      <PublicationsPublicationCard
        v-for="draft in publications"
        :key="draft.id"
        :publication="draft"
        :show-project-info="showProjectInfo"
        :show-status="!isDraft"
        :show-date="!isDraft"
        class="w-64 shrink-0 transition-transform duration-200 hover:scale-[1.02]"
        @click="goToPublication"
        @delete="(p) => emit('delete', p)"
      />
      <CommonViewAllCard
        v-if="totalCount > 5"
        :to="viewAllTo"
      />
    </CommonHorizontalScroll>
    
    <div v-else class="text-center py-8 text-sm text-gray-500">
      {{ isDraft ? t('publication.noPublicationsDescription') : t('publication.noReadyPublicationsDescription') }}
    </div>
  </div>
</template>
