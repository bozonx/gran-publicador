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
import { getUserSelectableStatuses, getStatusColor, getStatusClass, getStatusIcon } from '~/utils/publications'
import type { MediaItem } from '~/composables/useMedia'


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
  isLoading: isPublicationLoading, 
  deletePublication, 
  updatePublication,
  copyPublication,
  statusOptions,
  bulkOperation,
} = usePublications()
const { fetchChannels, channels } = useChannels()
const { canGoBack, goBack } = useNavigation()

const projectId = computed(() => currentPublication.value?.projectId || null)
const publicationId = computed(() => route.params.id as string)

// Publication problems detection
const { 
  getPublicationProblems, 
  getPublicationProblemLevel 
} = usePublications()

const linkedSocialMedia = computed(() => {
    if (!currentPublication.value?.posts) return []
    const platforms = currentPublication.value.posts.map((p: any) => p.channel?.socialMedia).filter(Boolean)
    return [...new Set(platforms)]
})

const supportedTypeOptions = computed(() => {
  return getPostTypeOptionsForPlatforms({
    t,
    platforms: linkedSocialMedia.value as any,
  })
})

const publicationProblems = computed(() => {
  if (!currentPublication.value) return []
  const problems = getPublicationProblems(currentPublication.value)
  
  // Media validation problems for publication-level media
  if (currentPublication.value.media && currentPublication.value.media.length > 0) {
      const mediaCount = currentPublication.value.media.length
      const mediaArray = currentPublication.value.media.map(m => ({ type: m.media?.type || 'UNKNOWN' }))
      const postType = currentPublication.value.postType
      
      let hasMediaError = false
      for (const platform of linkedSocialMedia.value) {
          const result = validatePostContent('', mediaCount, platform as any, mediaArray, postType)
          if (!result.isValid) {
              hasMediaError = true
              break
          }
      }
      
      if (hasMediaError) {
          problems.push({ type: 'critical', key: 'mediaValidation' })
      }
  }
  
  return problems
})

const normalizedPublicationMeta = computed<Record<string, any>>(() => {
  const meta = (currentPublication.value as any)?.meta

  if (typeof meta === 'object' && meta !== null) return meta

  if (typeof meta === 'string' && meta.trim()) {
    try {
      const parsed = JSON.parse(meta)
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch {
      return {}
    }
  }

  return {}
})

const hasMediaValidationErrors = computed(() => {
    return publicationProblems.value.some(p => p.key === 'mediaValidation')
})

const isLocked = computed(() => currentPublication.value?.status === 'READY')


const isDeleteModalOpen = ref(false)
const isDeleting = ref(false)
const isRepublishModalOpen = ref(false)
const isArchiveWarningModalOpen = ref(false)
const archiveWarningMessage = ref('')

const { updatePost } = usePosts()
const toast = useToast()
const isScheduleModalOpen = ref(false)
const newScheduledDate = ref('')
const isBulkScheduling = ref(false)
const showLlmModal = ref(false)
const llmModalRef = ref<{ onApplySuccess: () => void; onApplyError: () => void } | null>(null)

const isContentActionModalOpen = ref(false)
const contentActionMode = ref<'copy' | 'move'>('copy')

// Social posting
const { 
  publishPublication, 
  isPublishing, 
  canPublishPublication 
} = useSocialPosting()

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

const majoritySchedule = computed(() => {
    if (!currentPublication.value?.posts?.length) return { date: null, conflict: false }
    
    // Collect dates: prefer scheduledAt, then publishedAt
    const dates = currentPublication.value.posts
        .map((p: any) => p.scheduledAt || p.publishedAt)
        .filter((d: string | null) => !!d) as string[]

    if (dates.length === 0) return { date: null, conflict: false }

    const counts: Record<string, number> = {}
    dates.forEach(d => {
        counts[d] = (counts[d] || 0) + 1
    })

    let maxCount = 0
    let majorityDate = null
    
    for (const [date, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count
            majorityDate = date
        }
    }

    const uniqueDates = Object.keys(counts)
    const conflict = uniqueDates.length > 1
    
    return { date: majorityDate, conflict }
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

/**
 * Handle successful publication update
 */
async function handleSuccess(id: string) {
  // Refresh publication data to keep page-level computed properties in sync
  // (e.g. isContentOrMediaMissing, publicationProblems)
  if (publicationId.value) {
    await fetchPublication(publicationId.value)
  }
}



/**
 * Handle post deletion
 */
async function handlePostDeleted() {
    // Refresh publication to remove deleted post
    if (publicationId.value) {
        await fetchPublication(publicationId.value)
    }
}

/**
 * Handle cancel
 */
function handleCancel() {
  goBack()
}

const collections = computed(() => [
  { label: t('common.view', 'View'), icon: 'i-heroicons-eye', to: `/publications/${publicationId.value}` },
  { label: t('common.edit', 'Edit'), icon: 'i-heroicons-pencil-square', to: `/publications/${publicationId.value}/edit` }
])

async function handleArchiveToggle() {
    if (!currentPublication.value) return
    await fetchPublication(currentPublication.value.id)
}
async function handleDelete() {
    if (!currentPublication.value) return
    
    const pid = projectId.value // Capture project ID
    
    isDeleting.value = true
    const success = await deletePublication(currentPublication.value.id)
    isDeleting.value = false
    if (success) {
        isDeleteModalOpen.value = false
        // Navigate to project page or drafts page
        if (pid) {
            router.push(`/projects/${pid}`)
        } else {
            router.push('/publications')
        }
    }
}

async function handleApplyLlm(data: {
  publication?: { title?: string; description?: string; tags?: string; content?: string }
  posts?: Array<{ channelId: string; content?: string; tags?: string }>
  meta?: Record<string, any>
}) {
  if (!currentPublication.value) return
  
  try {
    // Update publication fields
    if (data.publication && Object.keys(data.publication).length > 0) {
      const pubPayload: Record<string, any> = { ...data.publication }

      // Ensure authorComment is not populated from LLM generation
      if ('authorComment' in pubPayload) {
        delete pubPayload['authorComment']
      }

      if (data.meta) {
        const existingMeta = normalizedPublicationMeta.value
        pubPayload.meta = { ...existingMeta, ...data.meta }
      }
      await updatePublication(currentPublication.value.id, pubPayload)
    } else if (data.meta) {
      const existingMeta = normalizedPublicationMeta.value
      await updatePublication(currentPublication.value.id, { meta: { ...existingMeta, ...data.meta } })
    }

    // Update post fields
    if (data.posts && data.posts.length > 0) {
      const postMap = new Map(
        (currentPublication.value.posts || []).map((p: any) => [p.channelId, p.id])
      )
      for (const postData of data.posts) {
        const postId = postMap.get(postData.channelId)
        if (!postId) continue
        const postPayload: Record<string, any> = {}
        if (postData.content !== undefined) postPayload.content = postData.content
        if (postData.tags !== undefined) postPayload.tags = postData.tags
        if (Object.keys(postPayload).length > 0) {
          await updatePost(postId, postPayload, { silent: true })
        }
      }
    }

    // Refresh publication to reflect all changes
    await fetchPublication(currentPublication.value.id)

    toast.add({
      title: t('llm.applySuccess'),
      color: 'success'
    })
    llmModalRef.value?.onApplySuccess()
  } catch (e: any) {
    toast.add({
      title: t('llm.applyError'),
      description: t('common.saveError'),
      color: 'error'
    })
    llmModalRef.value?.onApplyError()
  }
}

function openScheduleModal() {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset()) // Adjust for local input
    newScheduledDate.value = now.toISOString().slice(0, 16)
    isScheduleModalOpen.value = true
}

async function handleBulkSchedule() {
    if (!currentPublication.value) return
    if (!newScheduledDate.value) return

    isBulkScheduling.value = true
    try {
        // Update only the publication's scheduledAt
        await updatePublication(currentPublication.value.id, {
            scheduledAt: new Date(newScheduledDate.value).toISOString()
        })
        
        toast.add({
            title: t('common.success'),
            description: t('publication.scheduleUpdated'),
            color: 'success'
        })

        isScheduleModalOpen.value = false
        // Refresh publication
        if (currentPublication.value) {
            await fetchPublication(currentPublication.value.id)
        }
    } catch (err: any) {
        console.error('Failed to schedule publication:', err)
        toast.add({
            title: t('common.error'),
            description: t('common.saveError'),
            color: 'error'
        })
    } finally {
        isBulkScheduling.value = false
    }
}

// Language and Type Editing
const { languageOptions } = useLanguages()
const { typeOptions } = usePosts()
const { templates: projectTemplates, fetchProjectTemplates } = useProjectTemplates()

const isDuplicateModalOpen = ref(false)
const isProjectModalOpen = ref(false)
const isTemplateModalOpen = ref(false)
const newProjectId = ref<string | undefined>(undefined)
const newTemplateId = ref<string | undefined>(undefined)
const isUpdatingProject = ref(false)
const isUpdatingTemplate = ref(false)
const isRelationsModalOpen = ref(false)

function openDuplicateModal() {
    if (!currentPublication.value) return
    isDuplicateModalOpen.value = true
}

function handleDuplicateSuccess(id: string) {
    isDuplicateModalOpen.value = false
    router.push(`/publications/${id}/edit`)
}

function openProjectModal() {
    if (!currentPublication.value) return
    newProjectId.value = currentPublication.value.projectId || undefined
    isProjectModalOpen.value = true
}

function openTemplateModal() {
    if (!currentPublication.value) return
    newTemplateId.value = currentPublication.value.projectTemplateId || undefined
    isTemplateModalOpen.value = true
}

async function handleUpdateProject() {
    if (!currentPublication.value) return
    isUpdatingProject.value = true
    try {
        if (!newProjectId.value) return

        const success = await bulkOperation(
          [currentPublication.value.id],
          'MOVE',
          undefined,
          newProjectId.value,
        )

        if (!success) return

        isProjectModalOpen.value = false
        await fetchPublication(currentPublication.value.id)
    } catch (err: any) {
        console.error('Failed to update project:', err)
        toast.add({
            title: t('common.error'),
            description: t('common.saveError'),
            color: 'error'
        })
    } finally {
        isUpdatingProject.value = false
    }
}

async function handleUpdateTemplate(templateId: string) {
    if (!currentPublication.value) return
    if (currentPublication.value.projectTemplateId === templateId) {
        isTemplateModalOpen.value = false
        return
    }
    newTemplateId.value = templateId
    isUpdatingTemplate.value = true
    try {
        await updatePublication(currentPublication.value.id, {
            projectTemplateId: templateId
        })
        isTemplateModalOpen.value = false
        await fetchPublication(currentPublication.value.id)
    } catch (err: any) {
        console.error('Failed to update template:', err)
        toast.add({
            title: t('common.error'),
            description: t('common.saveError'),
            color: 'error'
        })
    } finally {
        isUpdatingTemplate.value = false
    }
}

const projectOptions = computed(() => {
    return projects.value.map(p => ({
        value: p.id,
        label: p.name
    }))
})

const templateOptions = computed(() => {
    return filteredProjectTemplates.value.map(tpl => ({ value: tpl.id, label: tpl.name }))
})

const filteredProjectTemplates = computed(() => {
    const pubLang = currentPublication.value?.language
    const pubType = currentPublication.value?.postType
    return projectTemplates.value.filter((tpl) => {
        const langMatch = !tpl.language || tpl.language === pubLang
        const typeMatch = !tpl.postType || tpl.postType === pubType
        return langMatch && typeMatch
    })
})

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

const newStatus = ref<PublicationStatus>('DRAFT')
const isUpdatingStatus = ref(false)

async function handleUpdateStatusOption(status: PublicationStatus) {
    if (!currentPublication.value) return
    if (currentPublication.value.status === status) {
        return
    }
    
    // Check content or media requirement for READY status
    if (status === 'READY' && isContentOrMediaMissing.value) {
        toast.add({
            title: t('common.error'),
            description: t('publication.validation.contentOrMediaRequired'),
            color: 'error'
        })
        return
    }

    newStatus.value = status
    isUpdatingStatus.value = true
    try {
        await updatePublication(currentPublication.value.id, {
            status: status
        })
        await fetchPublication(currentPublication.value.id)
    } catch (err: any) {
        console.error('Failed to update status:', err)
        toast.add({
            title: t('common.error'),
            description: t('common.saveError'),
            color: 'error'
        })
    } finally {
        isUpdatingStatus.value = false
    }
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
  
  await executePublish(false)
}

async function handleConfirmArchivePublish() {
    isArchiveWarningModalOpen.value = false
    
    if (!currentPublication.value) return

    // Proceed to Republish check logic matching handlePublishNow
    if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(currentPublication.value.status)) {
        isRepublishModalOpen.value = true
        return
    }

    await executePublish(true)
}

async function handleConfirmRepublish() {
    isRepublishModalOpen.value = false
    // When manually republishing, we use force=true to ensure all posts are processed
    await executePublish(true)
}

async function executePublish(force: boolean) {
  if (!currentPublication.value) return

  try {
    const result = await publishPublication(currentPublication.value.id, force)
    
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
    <!-- Delete Confirmation Modal -->
    <UiConfirmModal
      v-if="isDeleteModalOpen"
      v-model:open="isDeleteModalOpen"
      :title="t('publication.deleteConfirm')"
      :description="t('publication.deleteCascadeWarning')"
      :confirm-text="t('common.delete')"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      :loading="isDeleting"
      @confirm="handleDelete"
    />

    <!-- Republish Confirmation Modal -->
    <UiConfirmModal
      v-if="isRepublishModalOpen"
      v-model:open="isRepublishModalOpen"
      :title="t('publication.republishConfirm')"
      :description="currentPublication?.status === 'FAILED' ? t('publication.republishFailedWarning') : t('publication.republishWarning')"
      :confirm-text="t('publication.republish', 'Republish')"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      :loading="isPublishing"
      @confirm="handleConfirmRepublish"
    />

    <!-- Archive Warning Modal -->
    <UiConfirmModal
      v-if="isArchiveWarningModalOpen"
      v-model:open="isArchiveWarningModalOpen"
      :title="t('publication.archiveWarning.title')"
      :description="archiveWarningMessage + '\n\n' + t('publication.archiveWarning.confirm')"
      :confirm-text="t('publication.archiveWarning.publishAnyway')"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      :loading="isPublishing"
      @confirm="handleConfirmArchivePublish"
    />

    <!-- Schedule Modal -->
    <UiAppModal v-if="isScheduleModalOpen" v-model:open="isScheduleModalOpen" :title="t('publication.changeScheduleTitle')">
      <p class="text-gray-500 dark:text-gray-400 mb-4">
        {{ t('publication.changeScheduleInfo') }}
      </p>

      <UFormField :label="t('publication.newScheduleTime')" required>
        <UInput v-model="newScheduledDate" type="datetime-local" class="w-full" icon="i-heroicons-clock" />
      </UFormField>

      <template #footer>
        <UButton
          color="neutral"
          variant="ghost"
          :label="t('common.cancel')"
          @click="isScheduleModalOpen = false"
        />
        <UButton
          color="primary"
          :label="t('common.save')"
          :loading="isBulkScheduling"
          @click="handleBulkSchedule"
        />
      </template>
    </UiAppModal>

    <!-- Duplicate Publication Modal -->
    <ModalsCreatePublicationModal
      v-if="currentPublication"
      v-model:open="isDuplicateModalOpen"
      :project-id="projectId || undefined"
      :preselected-language="currentPublication.language"
      :preselected-post-type="currentPublication.postType as any"
      :preselected-channel-ids="currentPublication.posts?.map((p: any) => p.channelId)"
      allow-project-selection
      :prefilled-title="currentPublication.title || ''"
      :prefilled-description="currentPublication.description || ''"
      :prefilled-author-comment="currentPublication.authorComment || ''"
      :prefilled-content="currentPublication.content || ''"
      :prefilled-tags="currentPublication.tags"
      :prefilled-meta="normalizedPublicationMeta"
      :prefilled-note="currentPublication.note || ''"
      :prefilled-media-ids="currentPublication.media?.map((m: any) => ({ id: m.media?.id, hasSpoiler: m.hasSpoiler }))"
      :prefilled-content-item-ids="currentPublication.contentItems?.map((ci: any) => ci.contentItemId)"
      :prefilled-author-signature-id="currentPublication.authorSignatureId || undefined"
      :prefilled-project-template-id="currentPublication.projectTemplateId || undefined"
      @success="handleDuplicateSuccess"
    />

    <!-- Project Change Modal -->
    <UiAppModal
      v-model:open="isProjectModalOpen"
      :title="t('project.title')"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <div class="space-y-4">
        <UFormField :label="t('project.title')">
          <CommonProjectSelect v-model="newProjectId" class="w-full" />
        </UFormField>
      </div>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isProjectModalOpen = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" :loading="isUpdatingProject" @click="handleUpdateProject">{{ t('common.save') }}</UButton>
      </template>
    </UiAppModal>

    <!-- Template Change Modal -->
    <UiAppModal
      v-model:open="isTemplateModalOpen"
      :title="t('projectTemplates.title', 'Publication Template')"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <div class="space-y-4">
        <UFormField :label="t('projectTemplates.title', 'Publication Template')">
          <USelectMenu
            v-model="newTemplateId"
            :items="templateOptions"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>
      </div>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isTemplateModalOpen = false">{{ t('common.cancel') }}</UButton>
        <UButton color="primary" :loading="isUpdatingTemplate" :disabled="!newTemplateId" @click="handleUpdateTemplate(newTemplateId!)">{{ t('common.save') }}</UButton>
      </template>
    </UiAppModal>

    <!-- Status Change Modal removed in favor of button group -->

    <!-- Loading state -->
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
                                        :disabled="((option as any).isSystem && currentPublication?.status === option.value) || (option.value === 'READY' && isContentOrMediaMissing && currentPublication?.status === 'DRAFT')"
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
                                    <span class="text-gray-900 dark:text-white font-medium text-base truncate max-w-[150px]">
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
                                        {{ languageOptions.find(l => l.value === currentPublication?.language)?.label || currentPublication?.language }}
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
                                        {{ typeOptions.find(t => t.value === currentPublication?.postType)?.label || currentPublication?.postType }}
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
                                     <UTooltip :text="currentPublication.archivedAt ? t('publication.archived_notice') : (isContentOrMediaMissing ? t('publication.validation.contentOrMediaRequired') : (hasMediaValidationErrors ? t('publication.validation.fixMediaErrors') : t('publication.scheduleLabel')))">
                                        <UButton
                                            :label="currentPublication.scheduledAt ? t('publication.changeSchedule') : t('publication.status.scheduleTime')"
                                            icon="i-heroicons-calendar-days"
                                            variant="soft"
                                            size="xs"
                                            color="primary"
                                            :disabled="isContentOrMediaMissing || hasMediaValidationErrors || !!currentPublication.archivedAt"
                                            @click="openScheduleModal"
                                        ></UButton>
                                    </UTooltip>
                                    
                                    <UTooltip :text="currentPublication.archivedAt ? t('publication.archived_notice') : (!currentPublication.posts?.length ? t('publication.noPosts') : (!canPublishPublication(currentPublication) ? (hasMediaValidationErrors ? t('publication.validation.fixMediaErrors') : t('publication.cannotPublish')) : ''))">
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
    <!-- LLM Generator Modal -->
    <ModalsLlmGeneratorModal
      v-if="currentPublication"
      ref="llmModalRef"
      v-model:open="showLlmModal"
      :publication-id="currentPublication.id"
      :content="currentPublication.content || undefined"
      :title="currentPublication.title || undefined"
      :media="((currentPublication.media || []).map(m => m.media).filter(Boolean) as any)"
      :project-id="projectId || undefined"
      :publication-meta="normalizedPublicationMeta"
      :post-type="currentPublication.postType || undefined"
      :publication-language="currentPublication.language || undefined"
      :post-channels="(currentPublication.posts || []).map((p: any) => ({
        channelId: p.channelId,
        channelName: p.channel?.name || '',
        language: p.channel?.language || currentPublication!.language,
        tags: p.channel?.tags ? p.channel.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        socialMedia: p.channel?.socialMedia,
      }))"
      @apply="handleApplyLlm"
    />

    <!-- Publication Relations Modal -->
    <ModalsPublicationRelationsModal
      v-if="currentPublication && projectId"
      v-model:open="isRelationsModalOpen"
      :publication="currentPublication"
      :project-id="projectId"
      @updated="() => fetchPublication(publicationId)"
    />

    <!-- Content Action Modal (Copy/Move to Content Library) -->
    <ContentCreateItemFromPublicationModal
      v-model:open="isContentActionModalOpen"
      :publication-id="publicationId"
      :scope="projectId ? 'project' : 'personal'"
      :project-id="projectId || undefined"
      :mode="contentActionMode"
    />
  </div>
</template>
