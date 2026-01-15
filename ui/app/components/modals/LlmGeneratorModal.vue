<script setup lang="ts">
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'

interface Emits {
  (e: 'insert', content: string): void
  (e: 'close'): void
}

interface Props {
  content?: string
  sourceTexts?: Array<{ content: string }>
  projectId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()
const toast = useToast()
const { generateContent, isGenerating, error } = useLlm()
const { transcribeAudio, isTranscribing, error: sttError } = useStt()
const {
  isRecording,
  recordingDuration,
  error: voiceError,
  startRecording,
  stopRecording,
} = useVoiceRecorder()
const { fetchUserTemplates, fetchProjectTemplates } = useLlmPromptTemplates()
const { user } = useAuth()

const isOpen = defineModel<boolean>('open', { required: true })

// Form state
const prompt = ref('')
const result = ref('')
const showAdvanced = ref(false)
const temperature = ref(0.7)
const maxTokens = ref(2000)

// Template selection
const selectedTemplateId = ref<string | null>(null)
const userTemplates = ref<LlmPromptTemplate[]>([])
const projectTemplates = ref<LlmPromptTemplate[]>([])
const isLoadingTemplates = ref(false)

// Context selection state
const useContent = ref(false)
const selectedSourceTexts = reactive(new Set<number>())

function toggleSourceText(index: number) {
  if (selectedSourceTexts.has(index)) {
    selectedSourceTexts.delete(index)
  } else {
    selectedSourceTexts.add(index)
  }
}

function truncateText(text: string, length = 120) {
  if (!text) return ''
  // Remove newlines and extra spaces
  const singleLine = text.replace(/[\r\n]+/g, ' ').trim()
  if (singleLine.length <= length) return singleLine
  return singleLine.substring(0, length) + '...'
}

// Metadata from last generation
const metadata = ref<any>(null)

// Load templates when modal opens
watch(isOpen, async (open) => {
  if (open) {
    // Load templates
    isLoadingTemplates.value = true
    try {
      if (user.value?.id) {
        userTemplates.value = await fetchUserTemplates(user.value.id)
      }
      if (props.projectId) {
        projectTemplates.value = await fetchProjectTemplates(props.projectId)
      }
    } finally {
      isLoadingTemplates.value = false
    }
  } else {
    // Reset form when modal closes
    prompt.value = ''
    result.value = ''
    metadata.value = null
    showAdvanced.value = false
    useContent.value = false
    selectedSourceTexts.clear()
    selectedTemplateId.value = null
  }
})

// Watch template selection and add template text to prompt
watch(selectedTemplateId, (templateId) => {
  if (!templateId) return
  
  const allTemplates = [...userTemplates.value, ...projectTemplates.value]
  const template = allTemplates.find(t => t.id === templateId)
  
  if (template) {
    // Add template prompt to existing prompt (don't replace)
    if (prompt.value && !prompt.value.endsWith('\n')) {
      prompt.value += '\n\n'
    }
    prompt.value += template.prompt
  }
})

// Computed options for template select
const templateOptions = computed(() => {
  const options: Array<{ label: string; value: string | null; disabled?: boolean }> = [
    { label: t('llm.noTemplate'), value: null }
  ]
  
  if (userTemplates.value.length > 0) {
    options.push({ label: t('llm.personalTemplates'), value: 'personal-header', disabled: true })
    userTemplates.value.forEach(template => {
      options.push({ label: `  ${template.name}`, value: template.id })
    })
  }
  
  if (projectTemplates.value.length > 0) {
    options.push({ label: t('llm.projectTemplates'), value: 'project-header', disabled: true })
    projectTemplates.value.forEach(template => {
      options.push({ label: `  ${template.name}`, value: template.id })
    })
  }
  
  return options
})

// Watch for voice recording errors
watch(voiceError, (err) => {
  if (err) {
    toast.add({
      title: t('llm.recordingError'),
      description: t(`llm.${err}`),
      color: 'error',
    })
  }
})

async function handleGenerate() {
  console.log('Modal: handleGenerate clicked');
  if (!prompt.value.trim()) {
    console.log('Modal: Prompt is empty');
    toast.add({
      title: t('llm.promptRequired'),
      color: 'error',
    });
    return;
  }

  // Build full prompt with context
  let fullPrompt = ''
  if (useContent.value && props.content) {
    fullPrompt += `CONTEXT CONTENT:\n${props.content}\n\n`
  }
  
  if (props.sourceTexts && selectedSourceTexts.size > 0) {
    fullPrompt += `CONTEXT SOURCES:\n`
    props.sourceTexts.forEach((st, idx) => {
      if (selectedSourceTexts.has(idx)) {
        fullPrompt += `--- SOURCE ${idx + 1} ---\n${st.content}\n\n`
      }
    })
  }
  
  if (fullPrompt) {
    fullPrompt += `USER REQUEST:\n${prompt.value}`
  } else {
    fullPrompt = prompt.value
  }

  console.log('Modal: Calling generateContent');
  const response = await generateContent(fullPrompt, {
    temperature: temperature.value,
    max_tokens: maxTokens.value,
  });

  if (response) {
    console.log('Modal: Response received', response);
    result.value = response.content;
    metadata.value = response.metadata || null;
  } else {
    console.log('Modal: No response (error)');
    toast.add({
      title: t('llm.error'),
      description: error.value || t('llm.errorMessage'),
      color: 'error',
    });
  }
}

async function handleVoiceRecording() {
  if (isRecording.value) {
    // Stop recording
    const audioBlob = await stopRecording()
    
    if (!audioBlob) {
      toast.add({
        title: t('llm.recordingError'),
        color: 'error',
      })
      return
    }

    // Transcribe audio
    const text = await transcribeAudio(audioBlob)
    
    if (text) {
      prompt.value = text
      toast.add({
        title: t('llm.transcriptionSuccess', 'Transcription successful'),
        color: 'success',
      })
    } else {
      toast.add({
        title: t('llm.transcriptionError'),
        description: sttError.value || t('llm.errorMessage'),
        color: 'error',
      })
    }
  } else {
    // Start recording
    const success = await startRecording()
    
    if (!success) {
      toast.add({
        title: t('llm.recordingError'),
        color: 'error',
      })
    }
  }
}

const formattedDuration = computed(() => {
  const minutes = Math.floor(recordingDuration.value / 60)
  const seconds = recordingDuration.value % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

function handleInsert() {
  if (result.value) {
    emit('insert', result.value)
    isOpen.value = false
  }
}

function handleClose() {
  isOpen.value = false
  emit('close')
}
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('llm.generate')" size="2xl">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-primary" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {{ t('llm.generate') }}
        </h3>
      </div>
    </template>
    <div :class="FORM_SPACING.section">
      <!-- Context Block -->
      <div v-if="content || (sourceTexts && sourceTexts.length > 0)" class="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50">
        <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
          {{ t('llm.context') }}
        </div>
        
        <div class="space-y-2">
          <!-- Content context -->
          <div v-if="content" class="flex items-center gap-2">
            <UCheckbox v-model="useContent" :label="t('llm.useContent')" />
            <span class="text-xs text-gray-500 truncate flex-1">
              {{ truncateText(content) }}
            </span>
          </div>
          
          <!-- Source texts context -->
          <template v-if="sourceTexts">
            <div v-for="(st, idx) in sourceTexts" :key="idx" class="flex items-center gap-2">
              <UCheckbox 
                :model-value="selectedSourceTexts.has(idx)" 
                @update:model-value="toggleSourceText(idx)"
              >
                <template #label>
                  <span class="text-sm">{{ t('llm.sourceText') }} #{{ idx + 1 }}</span>
                </template>
              </UCheckbox>
              <span class="text-xs text-gray-500 truncate flex-1">
                {{ truncateText(st.content) }}
              </span>
            </div>
          </template>
        </div>
      </div>

      <!-- Template Selector --  >
      <UFormField v-if="templateOptions.length > 1" :label="t('llm.selectTemplate')">
        <USelect
          v-model="selectedTemplateId"
          :options="templateOptions"
          :loading="isLoadingTemplates"
          :disabled="isGenerating || isRecording || isTranscribing"
        />
      </UFormField>

      <!-- Prompt Input -->
      <UFormField :label="t('llm.promptLabel')" required>
        <div class="relative">
          <UTextarea
            v-model="prompt"
            :placeholder="t('llm.promptPlaceholder')"
            :rows="4"
            autoresize
            :disabled="isGenerating || isRecording || isTranscribing"
            class="w-full"
          />
          
          <!-- Voice Recording Button -->
          <div class="absolute bottom-2 right-2 flex items-center gap-2">
            <!-- Recording indicator -->
            <div v-if="isRecording" class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span class="relative flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span class="font-mono">{{ formattedDuration }}</span>
            </div>
            
            <!-- Transcribing indicator -->
            <div v-if="isTranscribing" class="text-sm text-gray-600 dark:text-gray-400">
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            </div>
            
            <!-- Microphone button -->
            <UButton
              :icon="isRecording ? 'i-heroicons-stop' : 'i-heroicons-microphone'"
              :color="isRecording ? 'error' : 'neutral'"
              :variant="isRecording ? 'solid' : 'ghost'"
              size="sm"
              :disabled="isGenerating || isTranscribing"
              :title="isRecording ? t('llm.stopRecording') : t('llm.startRecording')"
              @click="handleVoiceRecording"
            />
          </div>
        </div>
      </UFormField>

      <!-- Advanced Settings -->
      <div class="mt-4">
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          :icon="showAdvanced ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
          @click="showAdvanced = !showAdvanced"
        >
          {{ t('llm.advancedSettings') }}
        </UButton>

        <div v-if="showAdvanced" class="mt-4 space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <!-- Temperature -->
          <UFormField :label="t('llm.temperature')" :help="t('llm.temperatureHelp')">
            <div class="flex items-center gap-3">
              <UInput
                v-model.number="temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                :disabled="isGenerating"
                class="w-24"
              />
              <USlider
                v-model="temperature"
                :min="0"
                :max="2"
                :step="0.1"
                :disabled="isGenerating"
                class="flex-1"
              />
            </div>
          </UFormField>

          <!-- Max Tokens -->
          <UFormField :label="t('llm.maxTokens')" :help="t('llm.maxTokensHelp')">
            <UInput
              v-model.number="maxTokens"
              type="number"
              min="100"
              max="8000"
              :disabled="isGenerating"
              class="w-32"
            />
          </UFormField>
        </div>
      </div>

      <!-- Generate Button -->
      <div class="mt-4">
        <UButton
          color="primary"
          :loading="isGenerating"
          :disabled="!prompt.trim() || isRecording || isTranscribing"
          block
          @click="handleGenerate"
        >
          {{ isGenerating ? t('llm.generating') : t('llm.generate') }}
        </UButton>
      </div>

      <!-- Result -->
      <div v-if="result" class="mt-6">
        <UFormField :label="t('llm.resultLabel')">
          <UTextarea
            v-model="result"
            :rows="8"
            autoresize
            readonly
            class="w-full font-mono text-sm"
          />
        </UFormField>

        <!-- Metadata -->
        <div v-if="metadata" class="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-server" class="w-3 h-3" />
            <span>{{ t('llm.provider', 'Provider') }}: {{ metadata.provider }}</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-cpu-chip" class="w-3 h-3" />
            <span>{{ t('llm.model', 'Model') }}: {{ metadata.model_name }}</span>
          </div>
          <div v-if="metadata.fallback_used" class="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-3 h-3" />
            <span>{{ t('llm.fallbackUsed', 'Fallback model was used') }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        :disabled="isGenerating || isRecording || isTranscribing"
        @click="handleClose"
      >
        {{ t('common.cancel') }}
      </UButton>
      <UButton
        color="primary"
        :disabled="!result || isGenerating || isRecording || isTranscribing"
        @click="handleInsert"
      >
        {{ t('llm.insertContent') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
