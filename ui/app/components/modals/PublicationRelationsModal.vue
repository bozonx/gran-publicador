<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'
import type { RelationGroup } from '~/composables/usePublicationRelations'

interface Props {
  publication: PublicationWithRelations
  projectId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'updated'): void
}>()

const { t } = useI18n()
const toast = useToast()
const isOpen = defineModel<boolean>('open', { required: true })

const {
  relations,
  isLoading,
  error,
  hasRelations,
  fetchRelations,
  linkPublication,
  unlinkPublication,
  createRelated,
  reorderGroup,
} = usePublicationRelations()

const { publications, fetchPublicationsByProject } = usePublications()

const searchQuery = ref('')
const selectedType = ref<'SERIES' | 'TRANSLATION'>('TRANSLATION')
const selectedLanguage = ref(props.publication.language)

const { languageOptions } = useLanguages()
const router = useRouter()

const typeOptions = [
  { value: 'TRANSLATION', label: t('publication.relations.typeTranslation') },
  { value: 'SERIES', label: t('publication.relations.typeSeries') },
]

const filteredPublications = computed(() => {
  return publications.value
    .filter(p => {
      if (p.id === props.publication.id) return false
      if (p.postType !== props.publication.postType) return false
      if (!searchQuery.value) return true
      const q = searchQuery.value.toLowerCase()
      return (
        p.title?.toLowerCase().includes(q) ||
        p.language?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      )
    })
    .slice(0, 20)
    .map(p => ({
      id: p.id,
      title: p.title,
      language: p.language,
      status: p.status,
      archivedAt: p.archivedAt,
    }))
})

watch(isOpen, async (val) => {
  if (val && props.publication?.id) {
    await Promise.all([
      fetchRelations(props.publication.id),
      fetchPublicationsByProject(props.projectId, { limit: 100 }),
    ])
  }
})

async function handleLink(targetId: string) {
  try {
    await linkPublication(props.publication.id, targetId, selectedType.value)
    toast.add({ title: t('publication.relations.linked'), color: 'success' })
    emit('updated')
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: e.message || error.value || '',
      color: 'error',
    })
  }
}

async function handleUnlink(groupId: string) {
  try {
    await unlinkPublication(props.publication.id, groupId)
    toast.add({ title: t('publication.relations.unlinked'), color: 'success' })
    emit('updated')
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: e.message || error.value || '',
      color: 'error',
    })
  }
}

async function handleMove(group: RelationGroup, item: any, direction: 'up' | 'down') {
  const currentIndex = group.items.findIndex(i => i.id === item.id)
  const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  
  if (newIndex < 0 || newIndex >= group.items.length) return

  const itemsCopy = [...group.items]
  const [removed] = itemsCopy.splice(currentIndex, 1)
  if (removed) {
    itemsCopy.splice(newIndex, 0, removed)
  }

  const payload = itemsCopy.map((it, idx) => ({
    publicationId: it.publication.id,
    order: idx + 1
  }))

  try {
    await reorderGroup(props.publication.id, group.id, payload)
    toast.add({ title: t('common.updated'), color: 'success' })
    emit('updated')
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: e.message || error.value || '',
      color: 'error',
    })
  }
}

async function handleCreateRelated() {
  try {
    let title = props.publication.title || ''
    
    if (selectedType.value === 'SERIES') {
      const group = relations.value.find(g => g.type === 'SERIES')
      const nextNum = (group?.items.length || 1) + 1
      title = `${title} — ${t('publication.relations.typeSeries')} ${nextNum}`
    }

    const result = await createRelated(props.publication.id, selectedType.value, {
      title,
      language: selectedType.value === 'TRANSLATION' ? selectedLanguage.value : undefined
    })
    toast.add({ title: t('publication.relations.createdRelated'), color: 'success' })
    emit('updated')
    
    if (result?.publicationId) {
      navigateToPublication(result.publicationId)
    }
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: e.message || error.value || '',
      color: 'error',
    })
  }
}

function navigateToPublication(id: string) {
  isOpen.value = false
  router.push(`/publications/${id}/edit`)
}

function getPublicationStatusColor(status: string): 'success' | 'info' | 'primary' | 'error' | 'neutral' {
  switch (status) {
    case 'PUBLISHED': return 'success'
    case 'SCHEDULED': return 'info'
    case 'READY': return 'primary'
    case 'FAILED': return 'error'
    case 'DRAFT': return 'neutral'
    default: return 'neutral'
  }
}

function isInactiveChannel(pub: RelationGroup['items'][0]['publication']): boolean {
  if (!pub.posts?.length) return false
  return pub.posts.some(p =>
    !p.channel.isActive ||
    p.channel.archivedAt !== null ||
    p.channel.project?.archivedAt !== null
  )
}
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('publication.relations.title')" class="max-w-2xl">
    <template #body>
      <div class="space-y-6">
        <!-- Existing Relations -->
        <div v-if="hasRelations">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {{ t('publication.relations.currentRelations') }}
          </h4>

          <div v-for="group in relations" :key="group.id" class="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div class="flex items-center justify-between mb-2">
              <UBadge :color="group.type === 'SERIES' ? 'primary' : 'info'" variant="soft" size="sm">
                {{ group.type === 'SERIES' ? t('publication.relations.typeSeries') : t('publication.relations.typeTranslation') }}
              </UBadge>
              <UButton
                icon="i-heroicons-link-slash"
                color="error"
                variant="ghost"
                size="xs"
                :label="t('publication.relations.unlink')"
                @click="handleUnlink(group.id)"
              />
            </div>

            <div class="space-y-1.5">
              <div
                v-for="item in group.items"
                :key="item.id"
                class="flex items-center gap-2 text-sm px-2 py-1.5 rounded"
                :class="{
                  'bg-primary-50 dark:bg-primary-900/20': item.publication.id === publication.id,
                  'opacity-60': item.publication.archivedAt,
                }"
              >
                <span class="font-mono text-xs text-gray-400 w-5 text-right">{{ item.order + 1 }}.</span>
                <UBadge :color="getPublicationStatusColor(item.publication.status)" variant="soft" size="xs">
                  {{ item.publication.status }}
                </UBadge>
                <div class="flex-1 min-w-0 flex items-center gap-2">
                  <span class="font-mono text-xs px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded shrink-0">
                    {{ item.publication.language }}
                  </span>
                  <ULink
                    class="truncate hover:text-primary-500 transition-colors"
                    :class="{ 'italic text-gray-400': !item.publication.title }"
                    @click="navigateToPublication(item.publication.id)"
                  >
                    {{ item.publication.title || t('publication.noContent') }}
                  </ULink>
                </div>
                
                <div class="flex items-center gap-1 shrink-0">
                  <template v-if="group.type === 'SERIES'">
                    <UButton
                      icon="i-heroicons-chevron-up"
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      :disabled="group.items.indexOf(item) === 0"
                      @click="handleMove(group, item, 'up')"
                    />
                    <UButton
                      icon="i-heroicons-chevron-down"
                      variant="ghost"
                      color="neutral"
                      size="xs"
                      :disabled="group.items.indexOf(item) === group.items.length - 1"
                      @click="handleMove(group, item, 'down')"
                    />
                  </template>

                  <UIcon
                    v-if="item.publication.archivedAt"
                    name="i-heroicons-archive-box"
                    class="text-amber-500"
                  />
                  <UIcon
                    v-if="isInactiveChannel(item.publication)"
                    name="i-heroicons-exclamation-triangle"
                    class="text-amber-500"
                  />
                  <span v-if="item.publication.id === publication.id" class="text-xs text-primary-500 font-medium">
                    {{ t('common.current') }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <USeparator v-if="hasRelations" />

        <!-- Add New Relation -->
        <div>
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {{ t('publication.relations.addRelation') }}
          </h4>

          <div class="space-y-3">
            <!-- Type selector -->
            <USelectMenu
              v-model="selectedType"
              :items="typeOptions"
              value-key="value"
              label-key="label"
              class="w-full"
            />

            <!-- Search publications -->
            <CommonSearchInput
              v-model="searchQuery"
              :placeholder="t('publication.relations.searchPlaceholder')"
              class="w-full"
            />

            <!-- Results -->
            <div v-if="filteredPublications.length > 0" class="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                v-for="pub in filteredPublications"
                :key="pub.id"
                class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                :class="{ 'opacity-60': pub.archivedAt }"
                @click="handleLink(pub.id)"
              >
                <UBadge :color="getPublicationStatusColor(pub.status)" variant="soft" size="xs">
                  {{ pub.status }}
                </UBadge>
                <span class="font-mono text-xs px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                  {{ pub.language }}
                </span>
                <span class="truncate flex-1" :class="{ 'italic text-gray-400': !pub.title }">
                  {{ pub.title || t('publication.noContent') }}
                </span>
                <UIcon name="i-heroicons-link" class="text-gray-400 shrink-0" />
              </button>
            </div>

            <p v-else-if="searchQuery" class="text-sm text-gray-400 text-center py-2">
              {{ t('publication.relations.noResults') }}
            </p>

            <USeparator />

            <!-- Create related -->
            <div class="space-y-2 pt-2">
              <div v-if="selectedType === 'TRANSLATION'" class="flex items-center gap-2">
                <span class="text-xs text-gray-500 shrink-0">{{ t('news.language') }}:</span>
                <USelectMenu
                  v-model="selectedLanguage"
                  :items="languageOptions"
                  value-key="value"
                  label-key="label"
                  class="flex-1"
                />
              </div>

              <UButton
                icon="i-heroicons-plus"
                color="primary"
                variant="soft"
                block
                :label="t('publication.relations.createRelated')"
                :loading="isLoading"
                @click="handleCreateRelated"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
