<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  ChannelWithProject,
  ChannelCreateInput,
  ChannelUpdateInput,
  SocialMedia,
} from '~/composables/useChannels'
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'

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
  visibleSections?: ('general' | 'credentials' | 'preferences')[]
}

interface Emits {
  (e: 'success', channel: any): void | Promise<void>
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  channel: null,
  hideHeader: false,
  hideCancel: false,
  visibleSections: () => ['general', 'credentials', 'preferences'],
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

const SOCIAL_MEDIA_VALUES = ['TELEGRAM', 'INSTAGRAM', 'VK', 'YOUTUBE', 'TIKTOK', 'X', 'FACEBOOK', 'LINKEDIN', 'SITE'] as const

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
  }
})

// Validation Schema
const schema = computed(() => z.object({
  name: z.string().min(1, t('validation.required')),
  description: z.string().optional(),
  channelIdentifier: z.string().min(1, t('validation.required')),
  language: z.string().min(1, t('validation.required')),
  socialMedia: z.enum(SOCIAL_MEDIA_VALUES),
  credentials: z.object({
    telegramChannelId: z.string().optional(),
    telegramBotToken: z.string().optional(),
    vkAccessToken: z.string().optional(),
  }),
  preferences: z.object({
    staleChannelsDays: z.coerce.number().min(1, t('validation.min', { min: 1 })).optional()
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
  }
  nextTick(() => {
    saveOriginalState()
  })
}, { immediate: true })

/**
 * Form submission handler
 */
async function handleSubmit(event: FormSubmitEvent<Schema>) {
  try {
    const updateData: ChannelUpdateInput = {}

    if (isEditMode.value && props.channel) {
      // Update existing channel
      if (props.visibleSections.includes('general')) {
        updateData.name = event.data.name
        updateData.description = event.data.description
        updateData.channelIdentifier = event.data.channelIdentifier
      }

      // Add preferences
      if (props.visibleSections.includes('preferences')) {
        updateData.preferences = {
          staleChannelsDays: event.data.preferences?.staleChannelsDays
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
      if (event.data.preferences?.staleChannelsDays) {
        createData.preferences = {
          staleChannelsDays: event.data.preferences.staleChannelsDays
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
    INSTAGRAM: '@username',
    VK: 'club123456789',
    YOUTUBE: '@channelhandle',
    TIKTOK: '@username',
    X: '@username',
    FACEBOOK: 'page_username',
    SITE: 'https://example.com',
    LINKEDIN: 'username',
  }
  return socialMedia ? placeholders[socialMedia] : t('channel.identifierPlaceholder')
}

/**
 * Get identifier help text based on selected social media
 */
function getIdentifierHelp(socialMedia: SocialMedia | undefined): string {
  const helps: Record<SocialMedia, string> = {
    TELEGRAM: t('channel.identifierHelpTelegram'),
    INSTAGRAM: t('channel.identifierHelpInstagram'),
    VK: t('channel.identifierHelpVk'),
    YOUTUBE: t('channel.identifierHelpYoutube'),
    TIKTOK: t('channel.identifierHelpTiktok'),
    X: t('channel.identifierHelpX'),
    FACEBOOK: t('channel.identifierHelpFacebook'),
    SITE: t('channel.identifierHelpSite'),
    LINKEDIN: t('channel.identifierHelpLinkedin'),
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
        ref="formActionsRef"
        :loading="isLoading"
        :is-dirty="isDirty"
        :save-label="isEditMode ? t('common.save') : t('common.create')"
        :hide-cancel="hideCancel"
        :show-border="!hideHeader"
        @reset="handleReset"
        @cancel="handleCancel"
      />
    </UForm>
  </div>
</template>
