<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  ChannelWithProject,
  ChannelCreateInput,
  ChannelUpdateInput,
  SocialMedia,
  ChannelFooter,
} from '~/composables/useChannels'
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'
import { VueDraggable } from 'vue-draggable-plus'
import { useDebounceFn } from '@vueuse/core'
import { DialogTitle, DialogDescription, VisuallyHidden } from 'reka-ui'

interface Props {
  /** Project ID for creating new channel */
  projectId: string
  /** Channel data for editing, null for creating new */
  channel?: ChannelWithProject | null
  /** Whether to hide the header */
  hideHeader?: boolean
  /** Whether to hide the cancel button */
  hideCancel?: boolean
  /** Sections to show */
  visibleSections?: ('general' | 'credentials' | 'preferences' | 'footers')[]
  /** Whether the form is disabled (e.g. while another related form is saving) */
  disabled?: boolean
}

interface Emits {
  (e: 'success', channel: any): void | Promise<void>
  (e: 'cancel'): void
  (e: 'submit-start'): void
  (e: 'submit-end'): void
}

const props = withDefaults(defineProps<Props>(), {
  channel: null,
  hideHeader: false,
  hideCancel: false,
  visibleSections: () => ['general', 'credentials', 'preferences', 'footers'],
  disabled: false,
})

const emit = defineEmits<Emits>()

const formActionsRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)

const { t } = useI18n()
const { formatDateWithTime } = useFormatters()
const router = useRouter()
const toast = useToast()
const {
  createChannel,
  updateChannel,
  socialMediaOptions,
  isLoading,
  getSocialMediaIcon,
  getSocialMediaColor,
} = useChannels()

const { languageOptions } = useLanguages()
const { projects, fetchProjects } = useProjects()

const isEditMode = computed(() => !!props.channel?.id)

// Fetch projects for the selector
onMounted(() => {
  if (projects.value.length === 0) {
    fetchProjects()
  }
})

const currentProjectName = computed(() => {
  if (props.channel?.project?.name) return props.channel.project.name
  const project = projects.value.find(p => p.id === (props.channel?.projectId || props.projectId))
  return project?.name || '-'
})

const SOCIAL_MEDIA_VALUES = ['TELEGRAM', 'VK', 'YOUTUBE', 'TIKTOK', 'FACEBOOK', 'SITE'] as const

const state = reactive({
  name: props.channel?.name || '',
  description: props.channel?.description || '',
  socialMedia: (props.channel?.socialMedia || 'TELEGRAM') as SocialMedia,
  channelIdentifier: props.channel?.channelIdentifier || '',
  language: props.channel?.language || 'en-US',
  projectId: props.channel?.projectId || props.projectId,
  isActive: props.channel?.isActive ?? true,
  credentials: {
    telegramChannelId: props.channel?.credentials?.telegramChannelId || '',
    telegramBotToken: props.channel?.credentials?.telegramBotToken || '',
    vkAccessToken: props.channel?.credentials?.vkAccessToken || '',
  },
  preferences: {
    staleChannelsDays: props.channel?.preferences?.staleChannelsDays || undefined as number | undefined,
    footers: (props.channel?.preferences?.footers || []) as ChannelFooter[],
  },
  tags: props.channel?.tags || '',
})

// Validation Schema
const schema = computed(() => z.object({
  name: z.string().min(1, t('validation.required')),
  description: z.string().optional(),
  channelIdentifier: z.string().min(1, t('validation.required')),
  language: z.string().min(1, t('validation.required')),
  socialMedia: z.enum(SOCIAL_MEDIA_VALUES),
  tags: z.string().optional(),
  credentials: z.object({
    telegramChannelId: z.string().optional(),
    telegramBotToken: z.string().optional(),
    vkAccessToken: z.string().optional(),
  }),
  preferences: z.object({
    staleChannelsDays: z.coerce.number().min(1, t('validation.min', { min: 1 })).optional(),
    footers: z.array(z.object({
      id: z.string(),
      name: z.string().min(1, t('validation.required')),
      content: z.string().min(1, t('validation.required')),
      isDefault: z.boolean(),
    })).optional()
  }).optional()
}).superRefine((val, ctx) => {
  if (val.socialMedia === 'TELEGRAM') {
    if (!val.credentials.telegramChannelId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t('validation.required'),
        path: ['credentials', 'telegramChannelId']
      })
    }
    if (!val.credentials.telegramBotToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t('validation.required'),
        path: ['credentials', 'telegramBotToken']
      })
    }
  } else if (val.socialMedia === 'VK') {
    if (!val.credentials.vkAccessToken) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t('validation.required'),
        path: ['credentials', 'vkAccessToken']
      })
    }
  }
}))

type Schema = z.output<typeof schema.value>

// Dirty state tracking
const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(state)

// Save original state when component mounts or channel changes
watch(() => props.channel, () => {
  state.name = props.channel?.name || ''
  state.description = props.channel?.description || ''
  state.socialMedia = (props.channel?.socialMedia || 'TELEGRAM') as SocialMedia
  state.channelIdentifier = props.channel?.channelIdentifier || ''
  state.language = props.channel?.language || 'en-US'
  state.projectId = props.channel?.projectId || props.projectId
  state.isActive = props.channel?.isActive ?? true
  state.credentials = {
    telegramChannelId: props.channel?.credentials?.telegramChannelId || '',
    telegramBotToken: props.channel?.credentials?.telegramBotToken || '',
    vkAccessToken: props.channel?.credentials?.vkAccessToken || '',
  }
  state.preferences = {
    staleChannelsDays: props.channel?.preferences?.staleChannelsDays || undefined,
    footers: (props.channel?.preferences?.footers || []) as ChannelFooter[],
  }
  state.tags = props.channel?.tags || ''
  nextTick(() => {
    saveOriginalState()
  })
}, { immediate: true })

/**
 * Form submission handler
 */
async function handleSubmit(event: FormSubmitEvent<Schema>) {
  emit('submit-start')
  try {
    const updateData: ChannelUpdateInput = {}

    if (isEditMode.value && props.channel) {
      // Update existing channel
      if (props.visibleSections.includes('general')) {
        updateData.name = event.data.name
        updateData.description = event.data.description
        updateData.channelIdentifier = event.data.channelIdentifier
        updateData.tags = event.data.tags
      }

      // Add preferences
      if (props.visibleSections.includes('preferences') || props.visibleSections.includes('footers')) {
        updateData.preferences = {
          staleChannelsDays: state.preferences.staleChannelsDays,
          footers: state.preferences.footers,
        }
      }

      // Add credentials for supported channels
      if (props.visibleSections.includes('credentials')) {
        if (props.channel.socialMedia === 'TELEGRAM') {
          updateData.credentials = {
            telegramChannelId: event.data.credentials.telegramChannelId,
            telegramBotToken: event.data.credentials.telegramBotToken,
          }
        } else if (props.channel.socialMedia === 'VK') {
          updateData.credentials = {
            vkAccessToken: event.data.credentials.vkAccessToken,
          }
        }
      }

      const result = await updateChannel(props.channel.id, updateData)
      if (result) {
        await emit('success', result)
        formActionsRef.value?.showSuccess()
        // Update original state after successful save
        saveOriginalState()
      } else {
        throw new Error('Failed to update channel')
      }
    } else {
      // Create new channel
      const createData: ChannelCreateInput = {
        projectId: props.projectId,
        name: event.data.name,
        description: event.data.description,
        socialMedia: event.data.socialMedia,
        channelIdentifier: event.data.channelIdentifier,
        language: event.data.language,
        isActive: state.isActive,
      }

      // Add credentials for supported channels
      if (event.data.socialMedia === 'TELEGRAM') {
        createData.credentials = {
          telegramChannelId: event.data.credentials.telegramChannelId,
          telegramBotToken: event.data.credentials.telegramBotToken,
        }
      } else if (event.data.socialMedia === 'VK') {
        createData.credentials = {
          vkAccessToken: event.data.credentials.vkAccessToken,
        }
      }

      // Add preferences
      if (event.data.preferences?.staleChannelsDays || state.preferences.footers.length > 0) {
        createData.preferences = {
          staleChannelsDays: event.data.preferences?.staleChannelsDays,
          footers: state.preferences.footers,
        }
      }

      const result = await createChannel(createData)

      if (result) {
        await emit('success', result)
        formActionsRef.value?.showSuccess()
        // Update original state after successful save
        saveOriginalState()
      } else {
        throw new Error('Failed to create channel')
      }
    }
  } catch (error) {
    formActionsRef.value?.showError()
    toast.add({
      title: t('common.error'),
      description: t('common.saveError', 'Failed to save'),
      color: 'error',
      duration: 5000
    })
  } finally {
    emit('submit-end')
  }
}

function handleCancel() {
  emit('cancel')
}

function handleReset() {
  resetToOriginal()
}

/**
 * Get identifier placeholder based on selected social media
 */
function getIdentifierPlaceholder(socialMedia: SocialMedia | undefined): string {
  const placeholders: Record<SocialMedia, string> = {
    TELEGRAM: '@channel_name',
    VK: 'club123456789',
    YOUTUBE: '@channelhandle',
    TIKTOK: '@username',
    FACEBOOK: 'page_username',
    SITE: 'https://example.com',
  }
  return socialMedia ? placeholders[socialMedia] : t('channel.identifierPlaceholder')
}

/**
 * Get identifier help text based on selected social media
 */
function getIdentifierHelp(socialMedia: SocialMedia | undefined): string {
  const helps: Record<SocialMedia, string> = {
    TELEGRAM: t('channel.identifierHelpTelegram'),
    VK: t('channel.identifierHelpVk'),
    YOUTUBE: t('channel.identifierHelpYoutube'),
    TIKTOK: t('channel.identifierHelpTiktok'),
    FACEBOOK: t('channel.identifierHelpFacebook'),
    SITE: t('channel.identifierHelpSite'),
  }
  return socialMedia ? helps[socialMedia] : t('channel.identifierHelp')
}

const currentSocialMedia = computed(() => (isEditMode.value ? props.channel?.socialMedia : state.socialMedia))

const projectOptions = computed(() => 
  projects.value.map(project => ({
    value: project.id,
    label: project.name
  }))
)

// Footers logic
const isFooterModalOpen = ref(false)
const editingFooter = ref<ChannelFooter | null>(null)
const footerForm = reactive({
  id: '',
  name: '',
  content: '',
  isDefault: false
})

const deletedFooters = ref<ChannelFooter[]>([])
const showDeleted = ref(false)

const debouncedSave = useDebounceFn(async () => {
  if (!isEditMode.value || !props.channel) return
  
  try {
    const updateData: ChannelUpdateInput = {
      preferences: {
        ...state.preferences,
        footers: state.preferences.footers,
      }
    }
    await updateChannel(props.channel.id, updateData)
    saveOriginalState()
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: t('common.saveError', 'Failed to save'),
      color: 'error'
    })
  }
}, 1000)

async function autoSave() {
  await debouncedSave()
}

function openAddFooter() {
  editingFooter.value = null
  footerForm.id = crypto.randomUUID()
  footerForm.name = ''
  footerForm.content = ''
  footerForm.isDefault = state.preferences.footers.length === 0
  isFooterModalOpen.value = true
}

function openEditFooter(footer: ChannelFooter) {
  editingFooter.value = footer
  footerForm.id = footer.id
  footerForm.name = footer.name
  footerForm.content = footer.content
  footerForm.isDefault = footer.isDefault
  isFooterModalOpen.value = true
}

function saveFooter() {
  if (!footerForm.name || !footerForm.content) return

  if (footerForm.isDefault) {
    state.preferences!.footers.forEach((f: ChannelFooter) => f.isDefault = false)
  }

  if (editingFooter.value) {
    const index = state.preferences!.footers.findIndex((f: ChannelFooter) => f.id === footerForm.id)
    if (index !== -1) {
      state.preferences!.footers[index] = { ...footerForm }
    }
  } else {
    state.preferences!.footers.push({ ...footerForm })
  }

  // Ensure at least one is default if list is not empty
  if (state.preferences!.footers.length > 0 && !state.preferences!.footers.some((f: ChannelFooter) => f.isDefault)) {
    state.preferences!.footers[0].isDefault = true
  }

  isFooterModalOpen.value = false
  autoSave()
}

function restoreFooter(footer: ChannelFooter) {
  state.preferences.footers.push({ ...footer })
  deletedFooters.value = deletedFooters.value.filter(f => f.id !== footer.id)
  autoSave()
}

function deleteFooter(id: string) {
  const index = state.preferences!.footers.findIndex((f: ChannelFooter) => f.id === id)
  if (index !== -1) {
    const footer = state.preferences!.footers[index]
    const removedWasDefault = footer.isDefault
    
    // Add to session-only deleted list
    deletedFooters.value.push({ ...footer })
    
    state.preferences!.footers.splice(index, 1)
    
    if (removedWasDefault && state.preferences!.footers.length > 0) {
      state.preferences!.footers[0].isDefault = true
    }
    autoSave()
  }
}

function setDefaultFooter(id: string) {
  state.preferences!.footers.forEach((f: ChannelFooter) => {
    f.id === id ? f.isDefault = true : f.isDefault = false
  })
  autoSave()
}
</script>

<template>
  <div :class="[hideHeader ? '' : FORM_STYLES.wrapper]">
    <div v-if="!hideHeader" :class="FORM_SPACING.headerMargin">
      <h2 :class="FORM_STYLES.title">
        {{ isEditMode ? t('channel.editChannel') : t('channel.createChannel') }}
      </h2>
      <p :class="FORM_STYLES.subtitle">
        {{ isEditMode ? t('channel.editDescription') : t('channel.createDescription') }}
      </p>
    </div>

    <UForm :schema="schema" :state="state" :class="FORM_SPACING.section" @submit="handleSubmit">
      <div v-if="visibleSections.includes('general')" :class="FORM_SPACING.fields">
        <!-- Created date (read-only, edit mode only) -->
        <CommonFormReadOnlyField
          v-if="isEditMode && channel?.createdAt"
          :label="t('channel.createdAt', 'Created At')"
          :value="channel.createdAt"
          :help="t('channel.createdAtHelp', 'The date when this channel was created')"
          format-as-date
        />

        <!-- Project (read-only) -->
        <CommonFormReadOnlyField
          :label="t('channel.project', 'Project')"
          :value="currentProjectName"
          icon="i-heroicons-briefcase"
        />

        <!-- Channel language -->
        <div v-if="!isEditMode">
          <UFormField
            name="language"
            :label="t('channel.language')"
            required
            :help="t('channel.languageWarningOnCreate')"
          >
            <USelectMenu
              v-model="state.language"
              :items="languageOptions"
              value-key="value"
              label-key="label"
              class="w-full"
            >
              <template #leading>
                <UIcon name="i-heroicons-language" class="w-4 h-4" />
              </template>
            </USelectMenu>
          </UFormField>
        </div>
        <!-- Display current language for edit mode (read-only) -->
        <CommonFormReadOnlyField
          v-else
          :label="t('channel.language')"
          :value="languageOptions.find(o => o.value === channel?.language)?.label || channel?.language"
          :help="t('channel.languageCannotChange', 'Language cannot be changed after channel creation')"
          icon="i-heroicons-language"
        />

        <!-- Social media type (only for create mode) -->
        <div v-if="!isEditMode">
          <UFormField 
            name="socialMedia"
            :label="t('channel.socialMedia')" 
            required
            :help="t('channel.socialMediaWarningOnCreate')"
          >
            <USelectMenu
              v-model="state.socialMedia"
              :items="socialMediaOptions"
              value-key="value"
              label-key="label"
              class="w-full"
            />
          </UFormField>

          <!-- Social media preview -->
          <div
            v-if="state.socialMedia"
            class="mt-2 flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
          >
            <div
              class="p-1.5 rounded"
              :style="{ backgroundColor: getSocialMediaColor(state.socialMedia) + '20' }"
            >
              <UIcon
                :name="getSocialMediaIcon(state.socialMedia)"
                class="w-4 h-4"
                :style="{ color: getSocialMediaColor(state.socialMedia) }"
              />
            </div>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ socialMediaOptions.find((o) => o.value === state.socialMedia)?.label }}
            </span>
          </div>
        </div>

        <!-- Display current social media for edit mode -->
        <div v-else class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('channel.socialMedia') }}
          </label>
          <div
            class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <div
              class="p-2 rounded"
              :style="{
                backgroundColor: getSocialMediaColor(channel?.socialMedia || 'TELEGRAM') + '20',
              }"
            >
              <UIcon
                :name="getSocialMediaIcon(channel?.socialMedia || 'TELEGRAM')"
                class="w-5 h-5"
                :style="{ color: getSocialMediaColor(channel?.socialMedia || 'TELEGRAM') }"
              />
            </div>
            <span class="font-medium text-gray-900 dark:text-white">
              {{ socialMediaOptions.find((o) => o.value === channel?.socialMedia)?.label }}
            </span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('channel.socialMediaCannotChange') }}
          </p>
        </div>

        <!-- Channel name -->
        <UFormField name="name" :label="t('channel.name')" required>
          <UInput
            v-model="state.name"
            :placeholder="t('channel.namePlaceholder')"
            :class="FORM_STYLES.fieldFullWidth"
            :size="FORM_STYLES.inputSizeLarge"
          />
        </UFormField>

        <!-- Description -->
        <UFormField name="description" :label="t('channel.description', 'Description')">
          <UTextarea
            v-model="state.description"
            :placeholder="t('channel.descriptionPlaceholder', 'Enter channel description...')"
            :class="FORM_STYLES.fieldFullWidth"
            :rows="FORM_STYLES.textareaRows"
            autoresize
          />
        </UFormField>

        <!-- Channel identifier -->
        <UFormField
          name="channelIdentifier"
          :label="t('channel.identifier')"
          required
          :help="getIdentifierHelp(currentSocialMedia)"
        >
          <UInput
            v-model="state.channelIdentifier"
            :placeholder="getIdentifierPlaceholder(currentSocialMedia)"
            :class="FORM_STYLES.fieldFullWidth"
          />
        </UFormField>

        <!-- Channel tags (only for edit mode) -->
        <UFormField
          v-if="isEditMode"
          name="tags"
          :label="t('channel.tags', 'Tags')"
          :help="t('channel.tagsHelp', 'Channel tags for publication orientation')"
        >
          <UInput
            v-model="state.tags"
            :placeholder="t('channel.tagsPlaceholder', 'tag1, tag2, tag3')"
            :class="FORM_STYLES.fieldFullWidth"
          />
        </UFormField>
      </div>

      <!-- Telegram credentials -->
      <div v-if="visibleSections.includes('credentials') && currentSocialMedia === 'TELEGRAM'" :class="FORM_SPACING.fields">
        <div v-if="!hideHeader && visibleSections.includes('general')" :class="FORM_SPACING.sectionDivider">
          <h3 :class="FORM_STYLES.sectionTitle">
            {{ t('channel.telegramCredentials', 'Telegram Credentials') }}
          </h3>
        </div>
          
        <div :class="FORM_SPACING.nested">
          <UFormField
            name="credentials.telegramChannelId"
            :label="t('channel.telegramChannelId', 'Channel ID')"
            :help="t('channel.telegramChannelIdHelp', 'Telegram channel ID (e.g., -1001234567890)')"
          >
            <UInput
              v-model="state.credentials.telegramChannelId"
              :placeholder="t('channel.telegramChannelIdPlaceholder', '-1001234567890')"
              :class="FORM_STYLES.fieldFullWidth"
            />
          </UFormField>

          <UFormField
            name="credentials.telegramBotToken"
            :label="t('channel.telegramBotToken', 'Bot Token')"
            :help="t('channel.telegramBotTokenHelp', 'Telegram bot token from @BotFather')"
          >
            <UInput
              v-model="state.credentials.telegramBotToken"
              type="password"
              :placeholder="t('channel.telegramBotTokenPlaceholder', '110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw')"
              :class="FORM_STYLES.fieldFullWidth"
            />
          </UFormField>
        </div>
      </div>

      <!-- VK credentials -->
      <div v-if="visibleSections.includes('credentials') && currentSocialMedia === 'VK'" :class="FORM_SPACING.fields">
        <div v-if="!hideHeader && visibleSections.includes('general')" :class="FORM_SPACING.sectionDivider">
          <h3 :class="FORM_STYLES.sectionTitle">
            {{ t('channel.vkCredentials', 'VK Credentials') }}
          </h3>
        </div>
          
        <div :class="FORM_SPACING.nested">
          <UFormField
            name="credentials.vkAccessToken"
            :label="t('channel.vkAccessToken', 'Access Token')"
            :help="t('channel.vkAccessTokenHelp', 'Service or user access token for VK API')"
          >
            <UInput
              v-model="state.credentials.vkAccessToken"
              type="password"
              :placeholder="t('channel.vkAccessTokenPlaceholder', 'vk1.a.abc...')"
              :class="FORM_STYLES.fieldFullWidth"
            />
          </UFormField>
        </div>
      </div>

      <!-- Preferences -->
      <div v-if="visibleSections.includes('preferences')" :class="FORM_SPACING.fields">
        <div v-if="!hideHeader && (visibleSections.includes('general') || visibleSections.includes('credentials'))" :class="FORM_SPACING.sectionDivider">
          <h3 :class="FORM_STYLES.sectionTitle">
            {{ t('settings.preferences', 'Preferences') }}
          </h3>
        </div>
        
        <UFormField
          name="preferences.staleChannelsDays"
          :label="t('settings.staleChannelsDays', 'Stale Channels Warning (Days)')"
          :help="t('settings.staleChannelsDaysHelp', 'Show warning if channel has no published posts for this many days')"
        >
          <UInput
            v-model.number="state.preferences.staleChannelsDays"
            type="number"
            min="1"
            :placeholder="t('settings.defaultFromProject', 'Default from Project')"
            :class="FORM_STYLES.fieldFullWidth"
          />
        </UFormField>
      </div>


      <UiFormActions
        v-if="visibleSections.some(s => ['general', 'credentials', 'preferences'].includes(s))"
        ref="formActionsRef"
        :loading="isLoading"
        :is-dirty="isDirty"
        :disabled="disabled"
        :save-label="isEditMode ? t('common.save') : t('common.create')"
        :hide-cancel="hideCancel"
        :show-border="!hideHeader"
        @reset="handleReset"
        @cancel="handleCancel"
      />

      <!-- Footers Section -->
      <div v-if="visibleSections.includes('footers')" :class="[visibleSections.some(s => ['general', 'credentials', 'preferences'].includes(s)) ? 'mt-8' : '']" class="space-y-4">
        <Teleport defer v-if="isEditMode" to="#channel-footers-actions">
          <UButton
            icon="i-heroicons-plus"
            size="xs"
            color="primary"
            variant="soft"
            @click="openAddFooter"
          >
            {{ t('channel.addFooter') }}
          </UButton>
        </Teleport>

        <div v-if="!isEditMode" :class="FORM_SPACING.sectionDivider">
          <div class="flex items-center justify-between mb-4">
            <h3 :class="FORM_STYLES.sectionTitle" class="mb-0">
              {{ t('channel.footers') }}
            </h3>
            <UButton
              icon="i-heroicons-plus"
              size="xs"
              color="primary"
              variant="soft"
              @click="openAddFooter"
            >
              {{ t('channel.addFooter') }}
            </UButton>
          </div>
        </div>

        <div v-if="state.preferences.footers.length === 0" class="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <UIcon name="i-heroicons-chat-bubble-bottom-center-text" class="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('channel.noFooters') }}
          </p>
        </div>

        <VueDraggable
          v-model="state.preferences.footers"
          :animation="150"
          handle=".drag-handle"
          class="space-y-3"
          @end="autoSave"
        >
          <div
            v-for="footer in state.preferences.footers"
            :key="footer.id"
            class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer group"
            @click="openEditFooter(footer)"
          >
            <div class="flex items-center gap-3">
              <div 
                class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 -ml-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                @click.stop
              >
                <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
              </div>
              <div>
                <div class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {{ footer.name }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-md">
                  {{ footer.content }}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <UIcon 
                v-if="footer.isDefault" 
                name="i-heroicons-star-20-solid" 
                class="w-4 h-4 text-primary-500 mr-2" 
              />
              <div class="w-4 h-4 mr-2" v-else></div>
              
              <UButton
                icon="i-heroicons-trash"
                size="xs"
                variant="ghost"
                color="error"
                @click.stop="deleteFooter(footer.id)"
              />
            </div>
          </div>
        </VueDraggable>

        <!-- Deleted Footers (Session only) -->
        <div v-if="deletedFooters.length > 0" class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            :icon="showDeleted ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
            @click="showDeleted = !showDeleted"
          >
            {{ t('channel.deletedFooters', 'Deleted items ({count})', { count: deletedFooters.length }) }}
          </UButton>
          
          <div v-if="showDeleted" class="mt-2 space-y-2">
            <div
              v-for="footer in deletedFooters"
              :key="footer.id"
              class="flex items-center justify-between py-1.5 px-3 bg-gray-50/30 dark:bg-gray-800/20 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg opacity-50 hover:opacity-80 transition-opacity"
            >
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5 text-gray-400" />
                <div class="text-xs truncate max-w-[200px]">
                  <span class="text-gray-500 dark:text-gray-400 italic line-through mr-2">{{ footer.name }}</span>
                </div>
              </div>
              <UButton
                icon="i-heroicons-arrow-path"
                size="xs"
                variant="ghost"
                color="primary"
                class="scale-90"
                @click="restoreFooter(footer)"
              >
                {{ t('common.restore', 'Restore') }}
              </UButton>
            </div>
          </div>
        </div>
        
      </div>
    </UForm>

    <!-- Footer Modal -->
    <UiAppModal 
      v-if="visibleSections.includes('footers') || visibleSections.includes('preferences')" 
      v-model:open="isFooterModalOpen"
      :title="editingFooter ? t('channel.editFooter') : t('channel.addFooter')"
    >
      <div class="space-y-4">
        <UFormField :label="t('channel.footerName')" required>
          <UInput
            v-model="footerForm.name"
            :placeholder="t('channel.footerNamePlaceholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('channel.footerContent')" required>
          <UTextarea
            v-model="footerForm.content"
            :placeholder="t('channel.footerContentPlaceholder')"
            :rows="4"
            class="w-full"
          />
        </UFormField>

        <UCheckbox
          v-model="footerForm.isDefault"
          :label="t('channel.footerDefault')"
        />
      </div>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isFooterModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton color="primary" @click="saveFooter">
          {{ t('common.save') }}
        </UButton>
      </template>
    </UiAppModal>
  </div>
</template>
