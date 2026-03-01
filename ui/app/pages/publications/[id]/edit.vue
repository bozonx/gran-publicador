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

const isLocked = computed(() => currentPublication.value?.status === 'PROCESSING')
const isDesynced = computed(() => currentPublication.value?.meta?.isDesynced === true)


const isDuplicateModalOpen = ref(false)
const isCopyModalOpen = ref(false)
const isTemplateModalOpen = ref(false)
const isRelationsModalOpen = ref(false)
const showLlmModal = ref(false)
const isDeleteModalOpen = ref(false)
const isRepublishModalOpen = ref(false)
const isArchiveWarningModalOpen = ref(false)
const isScheduleModalOpen = ref(false)
const isContentActionModalOpen = ref(false)
const isPublishedWarningModalOpen = ref(false)
const hasShownPublishedWarning = ref(false)

const newTemplateId = ref<string | undefined>(undefined)
const newScheduledDate = ref('')
const archiveWarningMessage = ref('')
const contentActionMode = ref<'copy'>('copy')

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

// Reset warning flag when navigating to a different publication
watch(publicationId, () => {
    hasShownPublishedWarning.value = false
})

// Show published warning when landing on a published post
watch(
    () => [currentPublication.value?.id, currentPublication.value?.status],
    ([id, status]) => {
        // Only trigger if we are viewing the publication that is actually in the store
        // and avoid triggering on stale data from the previous publication
        if (id !== publicationId.value) return

        if (['PUBLISHED', 'PARTIAL', 'FAILED'].includes(status as any) && !hasShownPublishedWarning.value) {
            isPublishedWarningModalOpen.value = true
            hasShownPublishedWarning.value = true
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

function openCopyModal() {
    if (!currentProject.value) return
    targetProjectId.value = currentProject.value.id
    modalsRef.value?.setTargetProjectId(targetProjectId.value)
    isCopyModalOpen.value = true
}

const targetProjectId = ref<string | undefined>(undefined)

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
      label: t('publication.copyToProject'),
      icon: 'i-heroicons-document-duplicate',
      click: openCopyModal,
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
      v-model:copy-modal="isCopyModalOpen"
      v-model:template-modal="isTemplateModalOpen"
      v-model:llm-modal="showLlmModal"
      v-model:relations-modal="isRelationsModalOpen"
      v-model:content-action-modal="isContentActionModalOpen"
      v-model:published-warning-modal="isPublishedWarningModalOpen"
      :publication="currentPublication"
      :project-id="projectId"
      :template-options="templateOptions"
      :normalized-publication-meta="normalizedPublicationMeta"
      :initial-scheduled-date="newScheduledDate"
      :initial-target-project-id="targetProjectId"
      :initial-template-id="newTemplateId"
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
        <!-- Publication Header (Status, Project, Schedule, Actions) -->
        <PublicationsPublicationEditHeader
          v-if="currentPublication"
          :publication="currentPublication"
          :project="currentProject"
          :is-locked="isLocked"
          :is-desynced="isDesynced"
          :is-really-empty="isReallyEmpty"
          :has-media-validation-errors="hasMediaValidationErrors"
          :publication-problems="publicationProblems"
          :project-templates="projectTemplates"
          :template-options="templateOptions"
          :channels="channels"
          :language-options="languageOptions"
          :type-options="typeOptions"
          :is-publishing="isPublishing"
          :can-publish="canPublishPublication(currentPublication)"
          :status-options="statusOptions"
          @update-status="handleUpdateStatusOption"
          @open-template-modal="openTemplateModal"
          @open-relations-modal="isRelationsModalOpen = true"
          @open-schedule-modal="openScheduleModal"
          @publish-now="handlePublishNow"
          @refresh="() => fetchPublication(publicationId)"
        />



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
