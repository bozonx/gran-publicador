<script setup lang="ts">
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'
import { useModalAutoFocus } from '~/composables/useModalAutoFocus'
import LlmPromptTemplatePickerModal from '~/components/modals/LlmPromptTemplatePickerModal.vue'

interface Emits {
  (e: 'apply', data: { title?: string; description?: string; tags?: string; content?: string }): void
  (e: 'close'): void
}

interface Props {
  content?: string
  projectId?: string
}

const { content, projectId } = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()
const toast = useToast()
const { generateContent, isGenerating, error, estimateTokens } = useLlm()
const { transcribeAudio, isTranscribing, error: sttError } = useStt()
const {
  isRecording,
  recordingDuration,
  error: voiceError,
  startRecording,
  stopRecording,
} = useVoiceRecorder()
const { user } = useAuth()

const isOpen = defineModel<boolean>('open', { required: true })

// Steps
const step = ref(1) // 1: AI Chat, 2: Parameter Generation

// Step 1: Chat state
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
const chatMessages = ref<ChatMessage[]>([])
const prompt = ref('')

const modalDescription = computed(() => {
  return step.value === 1 ? t('llm.step1Description') : t('llm.step2Description')
})

// Step 2: Extraction state
const extractionResult = ref<LlmExtractResponse | null>(null)
const selectedFields = reactive({
  title: true,
  description: true,
  tags: true,
  content: false // Default to false if not from Step 1 next, will be updated logic-wise
})
const isExtracting = ref(false)
const isApplying = ref(false)

const modalRootRef = ref<HTMLElement | null>(null)

const promptInputRef = ref()
const step2TitleInputRef = ref()
const step2DescriptionTextareaRef = ref()
const step2ContentTextareaRef = ref()

const isStep1Open = computed(() => isOpen.value && step.value === 1)
const isStep2Open = computed(() => isOpen.value && step.value === 2)

const step2FocusCandidates = computed(() => {
  const candidates: Array<{ target: any }> = []

  if (selectedFields.title) {
    candidates.push({ target: step2TitleInputRef })
  }

  if (selectedFields.description) {
    candidates.push({ target: step2DescriptionTextareaRef })
  }

  if (selectedFields.content) {
    candidates.push({ target: step2ContentTextareaRef })
  }

  return candidates
})

useModalAutoFocus({
  open: isStep1Open,
  root: modalRootRef,
  candidates: [{ target: promptInputRef }],
})

useModalAutoFocus({
  open: isStep2Open,
  root: modalRootRef,
  candidates: step2FocusCandidates,
})

// Form common state
const showAdvanced = ref(false)
const temperature = ref(0.7)
const maxTokens = ref(2000)

// Template selection
const isTemplatePickerOpen = ref(false)

// Context selection state
const useContent = ref(false)

function truncateText(text: string, length = 120) {
  if (!text) return ''
  // Remove newlines and extra spaces
  const singleLine = text.replace(/[\r\n]+/g, ' ').trim()
  if (singleLine.length <= length) return singleLine
  return singleLine.substring(0, length) + '...'
}

// Metadata from last generation
const metadata = ref<any>(null)

// Token counter with debounce
const estimatedTokens = computed(() => {
  let total = estimateTokens(prompt.value)
  
  if (useContent.value && content) {
    total += estimateTokens(content)
  }
  
  return total
})

// Track if there are unsaved changes
const hasUnsavedChanges = computed(() => {
  if (step.value === 1 && chatMessages.value.length > 0) return true
  if (step.value === 2 && extractionResult.value) return true
  return false
})

// Load templates when modal opens
watch(isOpen, async (open) => {
  if (open) {
    if (content) {
      useContent.value = true
    }
  } else {
    // Reset form when modal closes
    step.value = 1
    chatMessages.value = []
    prompt.value = ''
    extractionResult.value = null
    metadata.value = null
    showAdvanced.value = false
    useContent.value = false
    isTemplatePickerOpen.value = false
    selectedFields.content = false
    isApplying.value = false
  }
})

function handleTemplateSelected(template: LlmPromptTemplate) {
  if (!template?.prompt?.trim()) return

  if (prompt.value.trim()) {
    prompt.value = prompt.value.trimEnd() + '\n\n'
  }

  prompt.value += template.prompt
}

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

const { extractParameters } = useLlm()

async function handleGenerate() {
  if (!prompt.value.trim()) {
    toast.add({
      title: t('llm.promptRequired'),
      color: 'error',
    });
    return;
  }

  // Add user message to chat
  chatMessages.value.push({ role: 'user', content: prompt.value });
  const currentPrompt = prompt.value;
  prompt.value = ''; // clear input

  const response = await generateContent(currentPrompt, {
    temperature: temperature.value,
    max_tokens: maxTokens.value,
    content: content,
    useContent: useContent.value,
  });

  if (response) {
    chatMessages.value.push({ role: 'assistant', content: response.content });
    metadata.value = response.metadata || null;
  } else {
    // Error handling already in useLlm, but we can add toast for better UX
    const errorDescription = t('llm.errorMessage');
    toast.add({
      title: t('llm.error'),
      description: errorDescription,
      color: 'error',
    });
  }
}

function handleSkip() {
  // Skip chat and go directly to Step 2 with current content
  step.value = 2
  selectedFields.content = false // Don't generate content if skipped
  // Don't call LLM - user explicitly skipped
  extractionResult.value = {
    title: '',
    description: '',
    tags: '',
    content: content || ''
  }
}

function handleNext() {
  const lastAssistantMessage = [...chatMessages.value].reverse().find(m => m.role === 'assistant')
  
  if (!lastAssistantMessage?.content?.trim()) {
    toast.add({
      title: t('llm.error'),
      description: t('llm.lastMessageEmpty'),
      color: 'error',
    })
    return
  }
  
  step.value = 2
  selectedFields.content = true // Generate content if coming from chat
  handleGenerationStep2(lastAssistantMessage.content)
}

async function handleGenerationStep2(contentSource: string) {
  isExtracting.value = true
  extractionResult.value = null
  
  try {
    const response = await extractParameters(contentSource, {
      temperature: temperature.value, // Use user's temperature setting
      max_tokens: maxTokens.value,
    })
    
    if (response) {
      // Validate that we got some data
      const hasData = response.title || response.description || response.tags || response.content
      
      if (!hasData) {
        toast.add({
          title: t('llm.extractionFailed'),
          description: t('llm.extractionEmpty'),
          color: 'warning',
        })
      }
      
      extractionResult.value = response
    } else {
       toast.add({
        title: t('llm.error'),
        description: t('llm.errorMessage'),
        color: 'error',
      });
    }
  } finally {
    isExtracting.value = false
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
    const text = await transcribeAudio(audioBlob, user.value?.language)
    
    if (text) {
      // Append to existing prompt instead of replacing
      if (prompt.value && !prompt.value.endsWith('\n')) {
        prompt.value += '\n\n'
      }
      prompt.value += text
      
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

const chatContainer = useTemplateRef<HTMLElement>('chatContainer')

watch(() => chatMessages.value.length, async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTo({
      top: chatContainer.value.scrollHeight,
      behavior: 'smooth'
    })
  }
})

function removeTag(tagToRemove: string) {
  if (!extractionResult.value || !extractionResult.value.tags) return
  
  const tags = extractionResult.value.tags.split(',').map(t => t.trim())
  const newTags = tags.filter(t => t !== tagToRemove.trim())
  extractionResult.value.tags = newTags.join(', ')
}

async function handleInsert() {
  if (!extractionResult.value) return
  
  // Check if at least one field is selected
  const hasSelection = selectedFields.title || selectedFields.description || 
                       selectedFields.tags || selectedFields.content
  
  if (!hasSelection) {
    toast.add({
      title: t('llm.error'),
      description: t('llm.noFieldsSelected'),
      color: 'error',
    })
    return
  }
  
  const data: { title?: string; description?: string; tags?: string; content?: string } = {}
  if (selectedFields.title && extractionResult.value.title) data.title = extractionResult.value.title
  if (selectedFields.description && extractionResult.value.description) data.description = extractionResult.value.description
  if (selectedFields.tags && extractionResult.value.tags) data.tags = extractionResult.value.tags
  if (selectedFields.content && extractionResult.value.content) data.content = extractionResult.value.content
  
  isApplying.value = true
  emit('apply', data)
  // Don't close immediately - let parent handle success/error
}

function handleClose() {
  // Check for unsaved changes
  if (hasUnsavedChanges.value) {
    const confirmed = confirm(t('llm.unsavedChangesMessage'))
    if (!confirmed) return
  }
  
  isOpen.value = false
  emit('close')
}

// Called by parent after successful save
function onApplySuccess() {
  isApplying.value = false
  isOpen.value = false
}

// Called by parent after failed save
function onApplyError() {
  isApplying.value = false
}

// Expose methods for parent component
defineExpose({
  onApplySuccess,
  onApplyError
})
import { DialogTitle, DialogDescription } from 'reka-ui'
</script>

<template>
  <UiAppModal v-model:open="isOpen" :title="t('llm.generate')" :description="modalDescription" size="2xl">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-primary" />
        <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {{ t('llm.generate') }}
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ modalDescription }}
        </DialogDescription>
      </div>
    </template>
    <div ref="modalRootRef" :class="FORM_SPACING.section">
      <!-- STEP 1: CHAT -->
      <template v-if="step === 1">

        <!-- Context Block (Compact) -->
        <UCollapsible v-if="content" class="mb-4">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            class="w-full justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
              {{ t('llm.context') }}
              <span v-if="useContent" class="text-xs font-normal text-primary">
                ({{ useContent ? 1 : 0 }} {{ t('common.selected') }})
              </span>
            </div>
            <template #trailing>
               <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
            </template>
          </UButton>
          
          <template #content>
            <div class="mt-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50 space-y-2">
              <!-- Content context -->
              <div v-if="content" class="flex items-center gap-2">
                <UCheckbox v-model="useContent" :label="t('llm.useContent')" />
                <span class="text-xs text-gray-500 truncate flex-1">
                  {{ truncateText(content) }}
                </span>
              </div>
            </div>
          </template>
        </UCollapsible>

        <!-- Chat Area -->
        <div 
          ref="chatContainer"
          class="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto mb-4 border border-gray-200 dark:border-gray-700/50 rounded-lg bg-gray-50/30 dark:bg-gray-900/10 p-4 space-y-4"
        >
          <div v-if="chatMessages.length === 0" class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 opacity-60">
             <UIcon name="i-heroicons-chat-bubble-left-right" class="w-12 h-12 mb-2" />
             <p class="text-sm">{{ t('llm.chatEmpty') }}</p>
          </div>
          
          <div 
            v-for="(msg, idx) in chatMessages" 
            :key="idx"
            class="flex flex-col"
            :class="msg.role === 'user' ? 'items-end' : 'items-start'"
          >
            <div 
              class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm"
              :class="msg.role === 'user' 
                ? 'bg-primary text-white rounded-tr-none' 
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700/50 rounded-tl-none shadow-sm'"
            >
              <div class="whitespace-pre-wrap">{{ msg.content }}</div>
            </div>
            <span class="text-[10px] text-gray-400 mt-1 uppercase font-medium tracking-tight">
              {{ msg.role === 'user' ? t('common.user') : t('common.assistant') }}
            </span>
          </div>
          
          <!-- Generating indicator -->
          <div v-if="isGenerating" class="flex items-start gap-2">
            <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/50 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
               <div class="flex gap-1.5">
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
               </div>
            </div>
          </div>
        </div>

        <!-- Template Picker -->
        <div class="mb-4">
          <UButton
            block
            color="neutral"
            variant="soft"
            icon="i-heroicons-squares-2x2"
            :disabled="isGenerating"
            @click="isTemplatePickerOpen = true"
          >
            {{ t('llm.selectTemplate') }}
          </UButton>

          <LlmPromptTemplatePickerModal
            v-model:open="isTemplatePickerOpen"
            :project-id="projectId"
            @select="handleTemplateSelected"
          />
        </div>

        <!-- Chat Input -->
        <div class="relative mb-4">
          <UTextarea
            ref="promptInputRef"
            v-model="prompt"
            :placeholder="t('llm.promptPlaceholder')"
            :rows="3"
            autoresize
            :disabled="isGenerating || isRecording || isTranscribing"
            class="w-full pr-12"
            @keydown.ctrl.enter="handleGenerate"
          />
          
          <div class="absolute bottom-2 right-2 flex items-center gap-1.5">
            <UTooltip :text="t('llm.voiceInputAppend')">
              <UButton
                icon="i-heroicons-microphone"
                :color="isRecording ? 'error' : 'neutral'"
                variant="ghost"
                size="sm"
                :disabled="isGenerating || isTranscribing"
                @click="handleVoiceRecording"
              />
            </UTooltip>
            <UButton
              icon="i-heroicons-paper-airplane"
              color="primary"
              variant="solid"
              size="sm"
              :loading="isGenerating"
              :disabled="!prompt.trim() || isRecording"
              @click="handleGenerate"
            />
          </div>
        </div>

        <!-- Advanced Settings (Step 1) -->
        <div class="pt-2">
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              :icon="showAdvanced ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
              class="mb-2"
              @click="showAdvanced = !showAdvanced"
            >
              {{ t('llm.advancedSettings') }}
            </UButton>

            <div v-show="showAdvanced" class="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <UFormField :label="t('llm.temperature')">
                    <UInput v-model.number="temperature" type="number" step="0.1" min="0" max="2" size="sm" class="w-full" />
                </UFormField>
                <UFormField :label="t('llm.maxTokens')">
                    <UInput v-model.number="maxTokens" type="number" min="100" max="8000" size="sm" class="w-full" />
                </UFormField>
            </div>
        </div>

        <!-- Metadata & Stats (Chat) -->
        <div class="mt-2 flex items-center justify-between text-[10px] text-gray-400 px-1">
           <div class="flex items-center gap-2">
              <span v-if="estimatedTokens">{{ t('llm.estimatedTokens', { count: estimatedTokens }) }}</span>
           </div>
           <div v-if="metadata" class="flex items-center gap-2">
              <span>{{ metadata.provider }} ({{ metadata.model_name }})</span>
           </div>
        </div>
      </template>

      <!-- STEP 2: PARAMETERS -->
      <template v-else-if="step === 2">

        <div v-if="isExtracting" class="flex flex-col items-center justify-center py-12 space-y-4">
           <UiLoadingSpinner size="lg" color="primary" :label="t('llm.processingParameters')" centered />
        </div>
        
        <div v-else-if="extractionResult" class="space-y-6">
           <p class="text-sm text-gray-500 mb-4 hidden">{{ t('llm.selectFieldsToApply') }}</p>
           
           <!-- Title -->
           <div class="space-y-2">
              <div class="flex items-center justify-between">
                <UCheckbox v-model="selectedFields.title" :label="t('post.title')" />
              </div>
              <UInput v-if="selectedFields.title" ref="step2TitleInputRef" v-model="extractionResult.title" class="bg-white dark:bg-gray-800 w-full" />
           </div>

           <!-- Description -->
           <div class="space-y-2">
              <div class="flex items-center justify-between">
                <UCheckbox v-model="selectedFields.description" :label="t('post.description')" />
              </div>
              <UTextarea v-if="selectedFields.description" ref="step2DescriptionTextareaRef" v-model="extractionResult.description" autoresize :rows="2" class="w-full" />
           </div>

           <!-- Tags -->
           <div class="space-y-2">
              <div class="flex items-center justify-between">
                <UCheckbox v-model="selectedFields.tags" :label="t('post.tags')" />
              </div>
              <div v-if="selectedFields.tags" class="p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 flex flex-wrap gap-1.5 min-h-[40px]">
                 <template v-if="extractionResult.tags">
                    <UButton
                      v-for="tag in extractionResult.tags.split(',')"
                      :key="tag"
                      size="xs"
                      color="neutral"
                      variant="soft"
                      class="rounded-full! px-2 py-0.5 h-auto"
                      @click="removeTag(tag)"
                    >
                      #{{ tag.trim() }}
                      <UIcon name="i-heroicons-x-mark" class="w-3 h-3 ml-1 opacity-50 hover:opacity-100" />
                    </UButton>
                 </template>
                 <span v-else class="text-xs text-gray-400 italic">{{ t('common.none') }}</span>
              </div>
           </div>

           <!-- Content -->
           <div class="space-y-2">
              <div class="flex items-center justify-between">
                <UCheckbox v-model="selectedFields.content" :label="t('post.contentLabel')" />
              </div>
              <UTextarea v-if="selectedFields.content" ref="step2ContentTextareaRef" v-model="extractionResult.content" autoresize :rows="5" class="font-mono text-xs w-full" />
           </div>
           
           <!-- Regenerate Button for Step 2 -->
           <div class="pt-4 border-t border-gray-100 dark:border-gray-700">
               <UButton 
                  block 
                  size="sm" 
                  variant="soft"
                  color="neutral"
                  icon="i-heroicons-arrow-path"
                  :disabled="isExtracting"
                  @click="handleGenerationStep2(chatMessages.length > 0 ? chatMessages[chatMessages.length-1]?.content || '' : (content || ''))"
                >
                    {{ t('llm.regenerate') }}
                </UButton>
           </div>
        </div>
      </template>
    </div>

    <template #footer>
      <div v-if="step === 1" class="flex justify-between w-full">
         <UButton
          color="neutral"
          variant="ghost"
          @click="handleClose"
        >
          {{ t('common.cancel') }}
        </UButton>
        <div class="flex gap-2">
           <UTooltip :text="t('llm.skipDescription')">
             <UButton
              color="neutral"
              variant="soft"
              @click="handleSkip"
            >
              {{ t('common.skip') }}
            </UButton>
           </UTooltip>
          <UTooltip :text="t('llm.nextDescription')">
            <UButton
              color="primary"
              class="min-w-[100px]"
              :disabled="!chatMessages.some(m => m.role === 'assistant')"
              @click="handleNext"
            >
              {{ t('common.next') }}
            </UButton>
          </UTooltip>
        </div>
      </div>

      <div v-else-if="step === 2" class="flex justify-between w-full">
         <UButton
          color="neutral"
          variant="ghost"
          icon="i-heroicons-arrow-left"
          @click="step = 1"
        >
          {{ t('common.back') }}
        </UButton>
        <UButton
          color="primary"
          class="min-w-[120px]"
          :disabled="isExtracting || !extractionResult"
          :loading="isApplying"
          icon="i-heroicons-check"
          @click="handleInsert"
        >
          {{ isApplying ? t('llm.applying') : t('common.apply') }}
        </UButton>
      </div>
    </template>
  </UiAppModal>
</template>
