<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { currentPublication } = usePublications()
const { currentChannel } = useChannels()
const { projects, fetchProjects } = useProjects()

const isSheetOpen = ref(false)

onMounted(() => {
  if (projects.value.length === 0) {
    fetchProjects()
  }
})

const hasProjects = computed(() => projects.value.length > 0)

const props = withDefaults(defineProps<{
  mode?: 'header' | 'fab'
}>(), {
  mode: 'header'
})

const initialProjectId = computed(() => {
  if (!route.path.startsWith('/projects/')) return undefined
  const id = route.params.id
  return typeof id === 'string' ? id : undefined
})

const initialChannelId = computed(() => {
  if (route.path.startsWith('/channels/')) {
    const id = route.params.id
    return typeof id === 'string' ? id : undefined
  }
  return undefined
})

const initialLanguage = computed(() => {
  if (route.path.startsWith('/publications/')) {
    return currentPublication.value?.language
  }
  if (route.path.startsWith('/channels/')) {
    return currentChannel.value?.language
  }
  return undefined
})

const initialPostType = computed(() => {
  if (route.path.startsWith('/publications/')) {
    return currentPublication.value?.postType as any
  }
  return undefined
})

const initialChannelIds = computed(() => {
  if (route.path.startsWith('/publications/')) {
    return currentPublication.value?.posts?.map((p: any) => p.channelId).filter(Boolean)
  }
  if (route.path.startsWith('/channels/')) {
    const id = route.params.id
    return typeof id === 'string' ? [id] : undefined
  }
  return undefined
})

const initialProjectIdFromContext = computed(() => {
  if (initialProjectId.value) return initialProjectId.value
  
  if (route.path.startsWith('/publications/')) {
    return currentPublication.value?.projectId || undefined
  }
  if (route.path.startsWith('/channels/')) {
    return currentChannel.value?.projectId || undefined
  }
  return undefined
})

// Modals state
const isPublicationModalOpen = ref(false)
const isProjectModalOpen = ref(false)
const isChannelModalOpen = ref(false)

// Dropdown items
const openPublicationModal = () => {
  isPublicationModalOpen.value = true
}

const openProjectModal = () => {
  isProjectModalOpen.value = true
}

const openChannelModal = () => {
  isChannelModalOpen.value = true
}


// Dropdown items
const items = computed(() => [
  [{
    label: t('publication.create'),
    icon: 'i-heroicons-document-text',
    disabled: !hasProjects.value,
    click: openPublicationModal
  }],
  [{
    label: t('channel.createChannel'),
    icon: 'i-heroicons-hashtag',
    disabled: !hasProjects.value,
    click: openChannelModal
  }, {
    label: t('project.createProject'),
    icon: 'i-heroicons-briefcase',
    click: openProjectModal
  }]
])

// Quick create publication (default action)
function quickCreatePublication() {
  isPublicationModalOpen.value = true
}

// Handle successful creation
function handleProjectCreated(projectId: string) {
  isProjectModalOpen.value = false
  router.push(`/projects/${projectId}`)
}

function handleChannelCreated(channelId: string, projectId: string) {
  isChannelModalOpen.value = false
  router.push(`/channels/${channelId}`)
}
</script>

<template>
  <div>
    <div v-if="mode === 'header'" class="inline-flex -space-x-px">
      <!-- Quick create button -->
      <UButton
        icon="i-heroicons-plus"
        color="primary"
        class="rounded-r-none"
        :disabled="!hasProjects"
        @click="quickCreatePublication"
      >
        {{ t('publication.title') }}
      </UButton>

      <!-- Dropdown menu -->
      <UDropdownMenu :items="items" :popper="{ placement: 'bottom-end' }">
        <UButton
          icon="i-heroicons-chevron-down"
          color="primary"
          square
          class="rounded-l-none"
        />

        <template #item="{ item }">
          <div class="flex items-center gap-2 w-full" @click="item.click && item.click()">
            <UIcon v-if="item.icon" :name="item.icon" class="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <span class="truncate">{{ item.label }}</span>
          </div>
        </template>
      </UDropdownMenu>
    </div>

    <!-- FAB Mode -->
    <div v-else class="fixed bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] right-4 z-30">
      <UButton
        icon="i-heroicons-plus"
        color="primary"
        size="xl"
        class="rounded-full shadow-xl w-14 h-14 flex items-center justify-center p-0"
        @click="isSheetOpen = true"
      />

      <UDrawer v-model:open="isSheetOpen">
        <template #content>
          <div class="p-4 pb-8 bg-white dark:bg-gray-950 rounded-t-3xl border-t border-gray-200 dark:border-gray-800">
            <div class="flex items-center justify-between mb-4 px-2">
              <h3 class="text-xl font-extrabold text-gray-900 dark:text-white">
                {{ t('common.create') }}
              </h3>
              <UButton
                icon="i-heroicons-x-mark"
                color="neutral"
                variant="ghost"
                @click="isSheetOpen = false"
              />
            </div>

            <div class="space-y-2">
              <template v-for="(group, groupIndex) in items" :key="groupIndex">
                <div class="space-y-1">
                  <UButton
                    v-for="item in group"
                    :key="item.label"
                    :icon="item.icon"
                    :label="item.label"
                    :disabled="item.disabled"
                    variant="ghost"
                    color="neutral"
                    block
                    class="justify-start text-base py-4 px-4 rounded-xl transition-all duration-200"
                    :class="item.disabled ? 'opacity-40' : 'hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.98]'"
                    @click="() => { if (!item.disabled) { item.click(); isSheetOpen = false } }"
                  >
                    <template #trailing>
                      <UIcon
                        v-if="item.disabled && item.label === t('publication.create')"
                        name="i-heroicons-lock-closed"
                        class="w-4 h-4 ml-auto text-gray-400"
                      />
                    </template>
                  </UButton>
                </div>
                <div
                  v-if="groupIndex < items.length - 1"
                  class="h-px bg-gray-100 dark:bg-gray-800 my-2 mx-1"
                />
              </template>
            </div>
            
            <div 
              v-if="!hasProjects" 
              class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex gap-2"
            >
              <UIcon name="i-heroicons-information-circle" class="w-4 h-4 shrink-0" />
              <span>{{ t('project.createFirst') || 'Сначала создайте проект, чтобы начать работу с публикациями.' }}</span>
            </div>
          </div>
        </template>
      </UDrawer>
    </div>

    <ModalsCreatePublicationModal
      v-if="isPublicationModalOpen"
      v-model:open="isPublicationModalOpen"
      :project-id="initialProjectIdFromContext"
      :preselected-language="initialLanguage"
      :preselected-post-type="initialPostType"
      :preselected-channel-ids="initialChannelIds"
      allow-project-selection
    />

    <!-- Create Project Modal -->
    <ModalsCreateProjectModal
      v-model:open="isProjectModalOpen"
      @created="handleProjectCreated"
    />

    <!-- Create Channel Modal -->
    <ModalsCreateChannelModal
      v-model:open="isChannelModalOpen"
      :initial-project-id="initialProjectIdFromContext"
      :show-project-select="true"
      @created="handleChannelCreated"
    />
  </div>
</template>


