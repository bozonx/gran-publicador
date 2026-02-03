<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { currentPublication } = usePublications()
const { currentChannel } = useChannels()

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
    click: openPublicationModal
  }],
  [{
    label: t('project.createProject'),
    icon: 'i-heroicons-briefcase',
    click: openProjectModal
  }, {
    label: t('channel.createChannel'),
    icon: 'i-heroicons-hashtag',
    click: openChannelModal
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
      <UDropdownMenu 
        :items="items" 
        :popper="{ placement: 'top-end' }"
      >
        <UButton
          icon="i-heroicons-plus"
          color="primary"
          size="xl"
          class="rounded-full shadow-xl w-14 h-14 flex items-center justify-center p-0"
        />

        <template #item="{ item }">
          <div class="flex items-center gap-2 w-full" @click="item.click && item.click()">
            <UIcon v-if="item.icon" :name="item.icon" class="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <span class="truncate">{{ item.label }}</span>
          </div>
        </template>
      </UDropdownMenu>
    </div>

    <ModalsCreatePublicationModal
      v-if="isPublicationModalOpen"
      v-model:open="isPublicationModalOpen"
      :project-id="initialProjectIdFromContext"
      :preselected-channel-id="initialChannelId"
      :preselected-language="initialLanguage"
      :preselected-post-type="initialPostType"
      :preselected-channel-ids="initialChannelIds"
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


