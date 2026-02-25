<script setup lang="ts">
import { useProjects } from '~/composables/useProjects'
import { usePublications } from '~/composables/usePublications'
import { useProjectTemplates } from '~/composables/useProjectTemplates'
import { useChannels } from '~/composables/useChannels'
import { usePosts } from '~/composables/usePosts'
import { stripHtmlAndSpecialChars, isTextContentEmpty } from '~/utils/text'
import { useSocialPosting } from '~/composables/useSocialPosting'
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation'
import { getPostTypeOptionsForPlatforms } from '~/utils/socialMediaPlatforms'
import type { PublicationStatus, PostType } from '~/types/posts'
import { ArchiveEntityType } from '~/types/archive.types'
import MediaGallery from '~/components/media/MediaGallery.vue'
import type { MediaItem } from '~/composables/useMedia'
import { usePublicationActions } from '~/composables/usePublicationActions'
import { useLanguages } from '~/composables/useLanguages'


definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { fetchProject, currentProject, projects, fetchProjects } = useProjects()
const { validatePostContent } = useSocialMediaValidation()
const { 
  fetchPublication, 
  currentPublication, 
  currentPublicationPlatforms: linkedSocialMedia,
  currentPublicationProblems: publicationProblems,
  isLoading: isPublicationLoading, 
  deletePublication, 
  updatePublication,
  copyPublication,
  statusOptions,
  bulkOperation,
  applyLlmResult: applyLlmViaService,
  getStatusColor,
  getStatusIcon,
  getPublicationProblemLevel 
} = usePublications()

const {
  majoritySchedule,
  normalizedPublicationMeta,
  applyLlmResult: applyLlm
} = usePublicationActions(currentPublication)
const { fetchChannels, channels } = useChannels()
const { canGoBack, goBack } = useNavigation()

const projectId = computed(() => currentPublication.value?.projectId || null)
const publicationId = computed(() => route.params.id as string)

const hasMediaValidationErrors = computed(() => {
    return publicationProblems.value.some(p => p.key === 'mediaValidation')
})

const isLocked = computed(() => currentPublication.value?.status === 'READY')


const isDuplicateModalOpen = ref(false)
const isProjectModalOpen = ref(false)
const isTemplateModalOpen = ref(false)
const isRelationsModalOpen = ref(false)
const showLlmModal = ref(false)
const isDeleteModalOpen = ref(false)
const isRepublishModalOpen = ref(false)
const isArchiveWarningModalOpen = ref(false)
const isScheduleModalOpen = ref(false)
const isContentActionModalOpen = ref(false)

const newProjectId = ref<string | undefined>(undefined)
const newTemplateId = ref<string | undefined>(undefined)
const newScheduledDate = ref('')
const archiveWarningMessage = ref('')
const contentActionMode = ref<'copy' | 'move'>('copy')

const modalsRef = ref<any>(null)

// Social posting
const { 
  publishPublication,
  publishPublicationNow,
  isPublishing, 
  canPublishPublication: baseCanPublishPublication 
} = useSocialPosting()

const canPublishPublication = (pub: any) => {
    if (!pub) return false
    if (pub.status === 'DRAFT') return false
    return baseCanPublishPublication(pub)
}

// Determine available channels (in project but not yet in publication)
const availableChannels = computed(() => {
    if (!channels.value || !currentPublication.value) return []
    const usedChannelIds = currentPublication.value.posts?.map((p: any) => p.channelId) || []
    return channels.value.filter(ch => !usedChannelIds.includes(ch.id))
})

const allPostsPublished = computed(() => {
    if (!currentPublication.value?.posts || currentPublication.value.posts.length === 0) return false
    return currentPublication.value.posts.every((p: any) => !!p.publishedAt)
})

const isContentEmpty = computed(() => {
    return isTextContentEmpty(currentPublication.value?.content)
})

const hasMedia = computed(() => {
    return Array.isArray(currentPublication.value?.media) && currentPublication.value!.media.length > 0
})

const isContentOrMediaMissing = computed(() => {
    // Only require content/media for non-DRAFT statuses
    if (currentPublication.value?.status === 'DRAFT') return false
    return isContentEmpty.value && !hasMedia.value
})

const isReallyEmpty = computed(() => isContentEmpty.value && !hasMedia.value)

const displayTitle = computed(() => {
  if (currentPublication.value?.title) {
    return stripHtmlAndSpecialChars(currentPublication.value.title)
  }
  if (currentPublication.value?.content) {
    const cleaned = stripHtmlAndSpecialChars(currentPublication.value.content)
    if (cleaned) return cleaned
  }
  return t('post.untitled')
})



// Check for openLlm param whenever publication is loaded
watch(
    () => [currentPublication.value, route.query.openLlm],
    async ([pub, openLlm]) => {
        // Ensure the publication is loaded AND it's the correct one for the current route
        if (pub && (pub as any).id === publicationId.value && openLlm === 'true') {
            // Wait for both publication data and route query to be stable
            await nextTick()
            
            // Re-check after tick
            if (currentPublication.value?.id === publicationId.value && route.query.openLlm === 'true') {
                // Remove query parameter from URL without reloading
                const { openLlm: _, ...restQuery } = route.query
                router.replace({ query: restQuery })
                
                // Small delay to ensure the component is fully mounted and ready
                setTimeout(() => {
                    showLlmModal.value = true
                }, 100)
            }
        }
    },
    { immediate: true }
)

onMounted(async () => {
    // Fetch publication first to get projectId
    if (publicationId.value) {
        await fetchPublication(publicationId.value)
    }

    // Fetch projects for modal
    await fetchProjects()

    // Fetch project if needed
    if (projectId.value && (!currentProject.value || currentProject.value.id !== projectId.value)) {
        await fetchProject(projectId.value)
    }
    
    if (projectId.value) {
        await Promise.all([
          fetchChannels({ projectId: projectId.value }),
          fetchProjectTemplates(projectId.value)
        ])
    }
})


// Watch for project changes (e.g. from the form)
watch(projectId, async (newId) => {
    if (newId) {
        await Promise.all([
            fetchChannels({ projectId: newId }),
            fetchProject(newId),
            fetchProjectTemplates(newId)
        ])
    }
})

const { updatePost } = usePosts()
const toast = useToast()
const { languageOptions } = useLanguages()
const { typeOptions } = usePosts()
const { templates: projectTemplates, fetchProjectTemplates } = useProjectTemplates()

async function handleApplyLlm(data: any) {
  await applyLlm(data)
}

function openScheduleModal() {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()) // Adjust for local input
    newScheduledDate.value = now.toISOString().slice(0, 16)
    modalsRef.value?.setNewScheduledDate(newScheduledDate.value)
    isScheduleModalOpen.value = true
}

/**
 * Handle successful publication update
 */
async function handleSuccess(id: string) {
  // refresh is automatic via usePublications
}

/**
 * Handle post deletion
 */
async function handlePostDeleted() {
    if (publicationId.value) {
        await fetchPublication(publicationId.value)
    }
}

function handleCancel() {
  goBack()
}

const collections = computed(() => [
  { label: t('common.view', 'View'), icon: 'i-heroicons-eye', to: `/publications/${publicationId.value}` },
  { label: t('common.edit', 'Edit'), icon: 'i-heroicons-pencil-square', to: `/publications/${publicationId.value}/edit` }
])

async function handleArchiveToggle() {
    // No explicit refetch needed
}

const userSelectableStatuses = computed(() => getUserSelectableStatuses(t))

const displayStatusOptions = computed(() => {
    const options = [
        { value: 'DRAFT', label: t('publicationStatus.draft') },
        { value: 'READY', label: t('publicationStatus.ready') }
    ]
    if (currentPublication.value && !['DRAFT', 'READY'].includes(currentPublication.value.status)) {
        options.push({
            value: currentPublication.value.status,
            label: statusOptions.value.find(s => s.value === currentPublication.value?.status)?.label || currentPublication.value.status,
            isSystem: true
        } as any)
    }
    return options
})

async function handleUpdateStatusOption(status: PublicationStatus) {
    if (!currentPublication.value || currentPublication.value.status === status) return
    if (status === 'READY' && isReallyEmpty.value) {
        toast.add({ title: t('common.error'), description: t('publication.validation.contentOrMediaRequired'), color: 'error' })
        return
    }
    try {
        await updatePublication(currentPublication.value.id, { status })
    } catch (err: any) {
        console.error('Failed to update status:', err)
        toast.add({ title: t('common.error'), description: t('common.saveError'), color: 'error' })
    }
}

const templateOptions = computed(() => filteredProjectTemplates.value.map((tpl: any) => ({ value: tpl.id, label: tpl.name })))

const filteredProjectTemplates = computed(() => {
    const pubLang = currentPublication.value?.language
    const pubType = currentPublication.value?.postType
    return projectTemplates.value.filter((tpl: any) => {
        const langMatch = !tpl.language || tpl.language === pubLang
        const typeMatch = !tpl.postType || tpl.postType === pubType
        return langMatch && typeMatch
    })
})

async function handleDeleteSuccess(pid?: string | null) {
    if (pid) {
        router.push(`/projects/${pid}`)
    } else {
        router.push('/publications')
    }
}

function openDuplicateModal() {
    isDuplicateModalOpen.value = true
}

function handleDuplicateSuccess(id: string) {
    isDuplicateModalOpen.value = false
    router.push(`/publications/${id}/edit`)
}

function openProjectModal() {
    if (!currentProject.value) return
    newProjectId.value = currentProject.value.id
    modalsRef.value?.setNewProjectId(newProjectId.value)
    isProjectModalOpen.value = true
}

function openTemplateModal() {
    if (!currentPublication.value) return
    newTemplateId.value = currentPublication.value.projectTemplateId || undefined
    modalsRef.value?.setNewTemplateId(newTemplateId.value)
    isTemplateModalOpen.value = true
}

const moreActions = computed(() => [
  [
    {
      label: t('publication.copyToContentLibrary'),
      icon: 'i-heroicons-arrow-down-on-square-stack',
      click: () => {
        contentActionMode.value = 'copy'
        isContentActionModalOpen.value = true
      },
      disabled: false,
      class: ''
    },
    {
      label: t('publication.moveToContentLibrary'),
      icon: 'i-heroicons-arrow-right-start-on-rectangle',
      click: () => {
        contentActionMode.value = 'move'
        isContentActionModalOpen.value = true
      },
      disabled: false,
      class: ''
    },
    {
      label: t('common.duplicate', 'Duplicate'),
      icon: 'i-heroicons-document-duplicate',
      click: openDuplicateModal,
      disabled: false,
      class: ''
    }
  ],
  [
    {
      label: t('common.delete'),
      icon: 'i-heroicons-trash',
      class: 'text-error-500 hover:text-error-600',
      click: () => { isDeleteModalOpen.value = true },
      disabled: false
    }
  ]
])


function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  const dObj = new Date(dateString)
  if (isNaN(dObj.getTime())) return '-'
  return dObj.toLocaleString()
}

async function handlePublishNow() {
  if (!currentPublication.value) return

  // Check for archive warnings
  let warning = ''
  if (currentPublication.value.archivedAt) {
      warning = t('publication.archiveWarning.publication')
  } else if (currentProject.value?.archivedAt) {
      warning = t('publication.archiveWarning.project', { name: currentProject.value.name })
  } else {
      // Check for inactive channels
      const inactiveChannels = currentPublication.value.posts
          ?.filter((p: any) => p.channel && !p.channel.isActive)
          .map((p: any) => p.channel.name) || []
      
      if (inactiveChannels.length > 0) {
          const names = [...new Set(inactiveChannels)].join(', ')
          warning = t('publication.archiveWarning.inactiveChannels', { names })
      }
  }

  if (warning) {
      archiveWarningMessage.value = warning
      isArchiveWarningModalOpen.value = true
      return
  }
  
  // If publication is not PENDING (already tried), warn the user
  if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(currentPublication.value.status)) {
    isRepublishModalOpen.value = true
    return
  }
  
  await executePublish(false, true)
}

async function handleConfirmArchivePublish() {
    isArchiveWarningModalOpen.value = false
    
    if (!currentPublication.value) return

    // Proceed to Republish check logic matching handlePublishNow
    if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(currentPublication.value.status)) {
        isRepublishModalOpen.value = true
        return
    }

    await executePublish(false, true)
}

async function handleConfirmRepublish() {
    isRepublishModalOpen.value = false
    // When manually republishing, we use force=true to ensure all posts are processed
    await executePublish(true, false)
}

async function executePublish(force: boolean, now: boolean = false) {
  if (!currentPublication.value) return

  try {
    const result = now 
      ? await publishPublicationNow(currentPublication.value.id)
      : await publishPublication(currentPublication.value.id, force)
    
    // Always update status if returned from server
    if (result.data?.status) {
      currentPublication.value.status = result.data.status as PublicationStatus
    }

    if (result.success) {
      toast.add({
        title: t('common.success'),
        description: t('publication.publishSuccess'),
        color: 'success'
      })
    } else {
      const isPartial = result.data?.failedCount && result.data.failedCount > 0
      const isFailed = result.data?.status === 'FAILED'
      
      // Output errors if they appeared after publication
      if ((isPartial || isFailed) && result.data?.results) {
         const errors = result.data.results
            .filter(r => !r.success && r.error)
            .map(r => r.error)
            .join('\n')
         
         if (errors) {
            toast.add({
                title: t('common.error'),
                description: errors,
                color: 'error'
            })
         }
      }

      toast.add({
        title: t('common.error'),
        description: t('publication.publishError'),
        color: 'error'
      })
    }
    
    // Always refresh publication to get latest meta, post statuses and messages
    await fetchPublication(currentPublication.value.id)

  } catch (error: any) {
    toast.add({
      title: t('common.error'),
      description: t('publication.publishError'),
      color: 'error'
    })
    // Refresh even on exception as some posts might have been updated before the crash
    if (currentPublication.value) {
        await fetchPublication(currentPublication.value.id)
    }
  }
}
</script>


<template>
  <div class="w-full">
    <!-- Collection Switcher -->
    <div class="mb-8 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <nav class="-mb-px flex space-x-8" aria-label="Collections">
        <NuxtLink
          v-for="collection in collections"
          :key="collection.to"
          :to="collection.to"
          class="group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="[
            route.path === collection.to
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          <UIcon :name="collection.icon" class="mr-2 h-5 w-5" :class="[route.path === collection.to ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500']" />
          {{ collection.label }}
        </NuxtLink>
      </nav>

      <!-- Action Buttons -->
      <div v-if="currentPublication" class="flex items-center gap-2 pb-2">
        <UTooltip :text="t('llm.tooltip')">
          <UButton
            icon="i-heroicons-sparkles"
            color="primary"
            variant="soft"
            size="sm"
            :disabled="isLocked"
            @click="showLlmModal = true"
          />
        </UTooltip>

        <UiArchiveButton
          :key="currentPublication.archivedAt ? 'archived' : 'active'"
          :entity-type="ArchiveEntityType.PUBLICATION"
          :entity-id="currentPublication.id"
          :is-archived="!!currentPublication.archivedAt"
          @toggle="handleArchiveToggle"
        />

        <UDropdownMenu :items="moreActions" :popper="{ placement: 'bottom-end', strategy: 'fixed' }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-ellipsis-horizontal"
            size="sm"
          />
          <template #item="{ item }">
            <div class="flex items-center gap-2 w-full truncate" :class="[(item as any).class || '', { 'opacity-50 cursor-not-allowed': item.disabled }]" @click="!item.disabled && item.click && item.click()">
              <UIcon v-if="item.icon" :name="item.icon" class="w-4 h-4 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </div>
          </template>
        </UDropdownMenu>
      </div>
    </div>
    <!-- Publication Modals -->
    <PublicationsPublicationEditModals
      v-if="currentPublication"
      ref="modalsRef"
      v-model:delete-modal="isDeleteModalOpen"
      v-model:republish-modal="isRepublishModalOpen"
      v-model:archive-warning-modal="isArchiveWarningModalOpen"
      v-model:schedule-modal="isScheduleModalOpen"
      v-model:duplicate-modal="isDuplicateModalOpen"
      v-model:project-modal="isProjectModalOpen"
      v-model:template-modal="isTemplateModalOpen"
      v-model:llm-modal="showLlmModal"
      v-model:relations-modal="isRelationsModalOpen"
      v-model:content-action-modal="isContentActionModalOpen"
      :publication="currentPublication"
      :project-id="projectId"
      :template-options="templateOptions"
      :normalized-publication-meta="normalizedPublicationMeta"
      @refresh="() => fetchPublication(publicationId)"
      @deleted="handleDeleteSuccess"
      @duplicate-success="handleDuplicateSuccess"
      @apply-llm="handleApplyLlm"
      @confirm-republish="handleConfirmRepublish"
      @confirm-archive-publish="handleConfirmArchivePublish"
    />

    <div v-if="isPublicationLoading && !currentPublication" class="flex items-center justify-center py-12">
        <UiLoadingSpinner size="md" />
    </div>

    <div v-else-if="currentPublication" class="space-y-6 pb-12">
        <!-- Archived Status Banner -->
        <CommonArchivedBanner
            v-if="currentPublication.archivedAt"
            :title="t('publication.archived_notice')"
            :description="t('publication.archived_info_banner')"
            :entity-type="ArchiveEntityType.PUBLICATION"
            :entity-id="currentPublication.id"
            @restore="() => fetchPublication(publicationId)"
        />

        <!-- Problems Banner -->
        <CommonProblemBanner
          v-if="publicationProblems.length > 0"
          :problems="publicationProblems"
          entity-type="publication"
          class="mb-6"
        />

        <!-- Content Empty Banner -->
        <UAlert
          v-if="isContentOrMediaMissing"
          color="info"
          variant="soft"
          icon="i-heroicons-information-circle"
          :title="t('publication.validation.contentOrMediaRequired')"
          class="mb-6"
        />

        <!-- Block 1: Publication Info & Actions (Non-collapsible) -->
        <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 shadow-sm">
            <div class="p-6">
                <!-- Actions moved to collections row -->

                <!-- Metadata Grid -->
                <div class="grid grid-cols-1 md:grid-cols-5 gap-6 text-sm">
                    <!-- Zone 1: Status, Project, Language and Type Column (40%) -->
                    <div class="space-y-4 md:col-span-2">
                        <!-- Status (Swapped with Project) -->
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs flex items-center gap-1.5">
                                {{ t('post.statusLabel') }}
                                <UPopover :popper="{ placement: 'top' }">
                                    <UIcon name="i-heroicons-information-circle" class="w-3.5 h-3.5 text-gray-400 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
                                    <template #content>
                                        <div class="p-3 max-w-xs text-xs whitespace-pre-line">
                                            {{ t('publication.changeStatusWarningReset') }}
                                        </div>
                                    </template>
                                </UPopover>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="inline-flex shadow-sm rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                    <UButton
                                        v-for="option in displayStatusOptions"
                                        :key="option.value"
                                        :label="option.label"
                                        color="neutral"
                                        variant="ghost"
                                        :disabled="((option as any).isSystem && currentPublication?.status === option.value) || (option.value === 'READY' && isReallyEmpty)"
                                        class="rounded-none border-r last:border-r-0 border-gray-200 dark:border-gray-700 transition-all px-4 py-2 font-medium"
                                        :class="[
                                            currentPublication?.status === option.value 
                                                ? (getStatusClass(option.value as PublicationStatus) + ' opacity-100! shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] disabled:opacity-100! disabled:cursor-default') 
                                                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 opacity-100'
                                        ]"
                                        @click="handleUpdateStatusOption(option.value as PublicationStatus)"
                                    >
                                        <template v-if="currentPublication?.status === option.value" #leading>
                                            <UIcon 
                                                :name="getStatusIcon(option.value as PublicationStatus)" 
                                                class="w-4 h-4" 
                                                :class="{ 'animate-spin': option.value === 'PROCESSING' }"
                                            />
                                        </template>
                                    </UButton>
                                </div>
                            </div>
                        </div>

                        <!-- Project and Language Row -->
                        <div class="grid grid-cols-2 gap-4">
                            <!-- Project Selector -->
                            <div>
                                <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                    {{ t('project.title') }}
                                </div>
                                <div v-if="currentPublication.projectId" class="flex items-center gap-2">
                                    <UIcon name="i-heroicons-folder" class="w-5 h-5 text-gray-400" />
                                    <span class="text-gray-900 dark:text-white font-medium text-base truncate">
                                        {{ currentPublication.project?.name || t('publication.personal_draft') }}
                                    </span>
                                    <UButton
                                        v-if="!isLocked"
                                        icon="i-heroicons-pencil-square"
                                        variant="ghost"
                                        color="neutral"
                                        size="xs"
                                        class="ml-1 text-gray-400 hover:text-primary-500 transition-colors"
                                        @click="openProjectModal"
                                    />
                                </div>
                                <div v-else>
                                    <UButton
                                        v-if="!isLocked"
                                        icon="i-heroicons-folder"
                                        variant="soft"
                                        color="primary"
                                        class="w-full justify-center shadow-sm"
                                        @click="openProjectModal"
                                    >
                                        {{ t('publication.selectProject') }}
                                    </UButton>
                                </div>
                            </div>

                            <!-- Template -->
                            <div>
                                <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                    {{ t('projectTemplates.title', 'Publication Template') }}
                                </div>
                                <div class="flex items-center gap-2">
                                    <UIcon name="i-heroicons-squares-plus" class="w-5 h-5 text-gray-400" />
                                    <span class="text-gray-900 dark:text-white font-medium text-base truncate max-w-37.5">
                                        {{ projectTemplates.find(tpl => tpl.id === currentPublication?.projectTemplateId)?.name || currentPublication?.projectTemplateId || '-' }}
                                    </span>
                                    <UButton
                                        v-if="!isLocked"
                                        icon="i-heroicons-pencil-square"
                                        variant="ghost"
                                        color="neutral"
                                        size="xs"
                                        class="ml-1 text-gray-400 hover:text-primary-500 transition-colors"
                                        @click="openTemplateModal"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Type and Language Row -->
                        <div class="grid grid-cols-2 gap-4">
                            <!-- Language -->
                            <div>
                                <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                    {{ t('common.language') }}
                                </div>
                                <div class="flex items-center gap-2">
                                    <UIcon name="i-heroicons-language" class="w-5 h-5 text-gray-400" />
                                    <span class="text-gray-900 dark:text-white font-medium text-base">
                                        {{ languageOptions.find((l: any) => l.value === currentPublication?.language)?.label || currentPublication?.language }}
                                    </span>
                                </div>
                            </div>

                            <!-- Type -->
                            <div>
                                <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                    {{ t('post.postType') }}
                                </div>
                                <div class="flex items-center gap-2">
                                    <UIcon name="i-heroicons-document-duplicate" class="w-5 h-5 text-gray-400" />
                                    <span class="text-gray-900 dark:text-white font-medium text-base">
                                        {{ typeOptions.find((t: any) => t.value === currentPublication?.postType)?.label || currentPublication?.postType }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Relations -->
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1 text-xs">
                                {{ t('publication.relations.title') }}
                            </div>
                            <div class="flex items-center gap-2">
                                <UIcon name="i-heroicons-link" class="w-5 h-5 text-gray-400" />
                                <template v-if="currentPublication?.relations?.length">
                                    <UBadge
                                        v-for="rel in currentPublication.relations"
                                        :key="rel.id"
                                        :color="rel.type === 'SERIES' ? 'primary' : 'info'"
                                        variant="soft"
                                        size="sm"
                                    >
                                        {{ rel.type === 'SERIES' ? t('publication.relations.typeSeries') : t('publication.relations.typeLocalization') }}
                                        ({{ rel.items.length }})
                                    </UBadge>
                                    <UButton
                                        v-if="!isLocked"
                                        icon="i-heroicons-pencil-square"
                                        variant="ghost"
                                        color="neutral"
                                        size="xs"
                                        class="ml-1 text-gray-400 hover:text-primary-500 transition-colors"
                                        @click="isRelationsModalOpen = true"
                                    />
                                </template>
                                <template v-else>
                                    <UButton
                                        v-if="!isLocked"
                                        icon="i-heroicons-plus"
                                        variant="soft"
                                        color="primary"
                                        size="xs"
                                        :label="t('publication.relations.add')"
                                        @click="isRelationsModalOpen = true"
                                    />
                                </template>
                            </div>
                        </div>
                    </div>

                    <!-- Zone 2: Channels & Scheduler (60%) -->
                    <div class="md:col-span-3 flex flex-col gap-6">
                        <!-- Channel Quick Access Block -->
                        <PublicationsChannelQuickAccessBlock
                          v-if="currentPublication"
                          :publication="currentPublication"
                          :channels="channels || []"
                          :disabled="isLocked"
                          @refresh="() => fetchPublication(publicationId)"
                        />

                        <div class="border-t border-gray-100 dark:border-gray-700/50 pt-2">
                             <div class="text-gray-500 dark:text-gray-400 text-xs mb-1">
                                {{ currentPublication.scheduledAt ? t('publication.status.willBePublishedAt') : t('publication.status.scheduling') }}
                             </div>
                             <div class="flex flex-col gap-2 items-start">
                                 <div v-if="currentPublication.scheduledAt" class="text-gray-900 dark:text-white font-medium flex flex-col">
                                      {{ formatDate(currentPublication.scheduledAt) }}
                                 </div>

                                 <div class="flex flex-row gap-2 mt-1">
                                     <UTooltip :text="currentPublication.archivedAt ? t('publication.archived_notice') : (isReallyEmpty ? t('publication.validation.contentOrMediaRequired') : (hasMediaValidationErrors ? t('publication.validation.fixMediaErrors') : t('publication.scheduleLabel')))">
                                        <UButton
                                            :label="currentPublication.scheduledAt ? t('publication.changeSchedule') : t('publication.status.scheduleTime')"
                                            icon="i-heroicons-calendar-days"
                                            variant="soft"
                                            size="xs"
                                            color="primary"
                                            :disabled="isReallyEmpty || hasMediaValidationErrors || !!currentPublication.archivedAt"
                                            @click="openScheduleModal"
                                        ></UButton>
                                     </UTooltip>
                                    
                                    <UTooltip :text="currentPublication.archivedAt ? t('publication.archived_notice') : (!currentPublication.posts?.length ? t('publication.noPosts') : (!canPublishPublication(currentPublication) ? (currentPublication.status === 'DRAFT' ? t('publication.validation.draftBlocked') : (hasMediaValidationErrors ? t('publication.validation.fixMediaErrors') : t('publication.cannotPublish'))) : ''))">
                                        <UButton
                                            :label="t('publication.publishNow')"
                                            icon="i-heroicons-paper-airplane"
                                            variant="soft"
                                            size="xs"
                                            color="success"
                                            :disabled="!canPublishPublication(currentPublication)"
                                            :loading="isPublishing"
                                            @click="handlePublishNow"
                                        ></UButton>
                                    </UTooltip>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>

                <!-- Footer: Creation Info -->
                <div class="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50 flex justify-end items-center text-xs text-gray-400">
                    <span class="mr-1">{{ t('post.createdAt') }}</span>
                    <span>{{ formatDate(currentPublication.createdAt) }}</span>
                    <template v-if="currentPublication.creator">
                        <span class="mx-1">·</span>
                        <span>{{ currentPublication.creator.fullName || currentPublication.creator.telegramUsername }}</span>
                    </template>
                </div>
            </div>
        </div>



        <!-- Publication Notes -->
        <PublicationsPublicationNotesBlock
          v-if="currentPublication"
          :publication="currentPublication"
          @update="() => fetchPublication(publicationId)"
        />

        <!-- Media Gallery (always expanded, horizontal scroll) -->
        <MediaGallery
          v-if="currentPublication"
          :media="(currentPublication.media as any) || []"
          :publication-id="currentPublication.id"
          :editable="!isLocked"
          :post-type="currentPublication.postType"
          :social-media="linkedSocialMedia"
          @refresh="() => fetchPublication(publicationId)"
        />

        <!-- Block 2: Publication Form (styled like PostEditBlock) -->
        <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 shadow-sm">
            <div class="p-6">
                <FormsPublicationForm
                  :project-id="projectId"
                  :publication="currentPublication"
                  autosave
                  @success="handleSuccess"
                  @cancel="handleCancel"
                ></FormsPublicationForm>
            </div>
        </div>

        <!-- Linked Posts Section -->
        <div>
          <div v-if="currentPublication.posts && currentPublication.posts.length > 0">
              <div class="flex items-center gap-2 mb-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('publication.postsInChannels') }}
                </h3>
              </div>
              
              <div class="space-y-4">
                <PostsPostEditBlock
                  v-for="post in currentPublication.posts"
                  :key="post.id"
                  :post="post"
                  :publication="currentPublication"
                  :channels="channels"
                  autosave
                  @deleted="handlePostDeleted"
                  @success="() => fetchPublication(publicationId)"
                ></PostsPostEditBlock>
              </div>
          </div>
          <div v-else class="text-center py-6 text-gray-500">
              <p>{{ t('publication.noPosts') }}</p>
          </div>
        </div>
    </div>
    
    <!-- Error/Not Found -->
    <div v-else class="text-center py-12">
        <p class="text-gray-500">{{ t('errors.notFound') }}</p>
    </div>
  </div>
</template>
