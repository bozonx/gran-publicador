<script setup lang="ts">
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'
import type { LlmPromptTemplate } from '~/types/llm-prompt-template'

interface Emits {
  (e: 'apply', data: { title?: string; description?: string; tags?: string; content?: string }): void
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
const { generateContent, isGenerating, error, estimateTokens } = useLlm()
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

// Steps
const step = ref(1) // 1: AI Chat, 2: Parameter Generation

// Step 1: Chat state
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
const chatMessages = ref<ChatMessage[]>([])
const prompt = ref('')

// Step 2: Extraction state
const extractionResult = ref<LlmExtractResponse | null>(null)
const selectedFields = reactive({
  title: true,
  description: true,
  tags: true,
  content: false // Default to false if not from Step 1 next, will be updated logic-wise
})
const isExtracting = ref(false)

// Form common state
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

// Token counter
const estimatedTokens = computed(() => {
  let total = estimateTokens(prompt.value)
  
  if (useContent.value && props.content) {
    total += estimateTokens(props.content)
  }
  
  if (props.sourceTexts && selectedSourceTexts.size > 0) {
    props.sourceTexts.forEach((st, idx) => {
      if (selectedSourceTexts.has(idx)) {
        total += estimateTokens(st.content)
      }
    })
  }
  
  return total
})

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
    step.value = 1
    chatMessages.value = []
    prompt.value = ''
    extractionResult.value = null
    metadata.value = null
    showAdvanced.value = false
    useContent.value = false
    selectedSourceTexts.clear()
    selectedTemplateId.value = null
    selectedFields.content = false
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

  // Prepare source texts for selected indexes
  const selectedSourceTextsArray = props.sourceTexts && selectedSourceTexts.size > 0
    ? Array.from(selectedSourceTexts)
        .map(idx => props.sourceTexts![idx])
        .filter((st): st is NonNullable<typeof st> => st !== undefined)
    : undefined;

  const response = await generateContent(currentPrompt, {
    temperature: temperature.value,
    max_tokens: maxTokens.value,
    content: props.content,
    sourceTexts: selectedSourceTextsArray,
    useContent: useContent.value,
  });

  if (response) {
    chatMessages.value.push({ role: 'assistant', content: response.content });
    metadata.value = response.metadata || null;
  } else {
    // Error handling already in useLlm, but we can add toast for better UX
    let errorDescription = error.value?.message || t('llm.errorMessage');
    toast.add({
      title: t('llm.error'),
      description: errorDescription,
      color: 'error',
    });
  }
}

function handleSkip() {
  step.value = 2
  selectedFields.content = false // Don't generate content if skipped
  handleGenerationStep2(props.content || '')
}

function handleNext() {
  step.value = 2
  const lastAssistantMessage = [...chatMessages.value].reverse().find(m => m.role === 'assistant')
  selectedFields.content = true // Generate content if coming from chat
  handleGenerationStep2(lastAssistantMessage?.content || '')
}

async function handleGenerationStep2(contentSource: string) {
  isExtracting.value = true
  extractionResult.value = null
  
  try {
    const response = await extractParameters(contentSource, {
      temperature: 0.3, // Stable JSON
      max_tokens: 2000,
    })
    
    if (response) {
      extractionResult.value = response
    } else {
       toast.add({
        title: t('llm.error'),
        description: error.value?.message || t('llm.errorMessage'),
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

const chatContainer = ref<HTMLElement | null>(null)

watch(() => chatMessages.value.length, async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTo({
      top: chatContainer.value.scrollHeight,
      behavior: 'smooth'
    })
  }
})

function handleInsert() {
  if (extractionResult.value) {
    const data: any = {}
    if (selectedFields.title) data.title = extractionResult.value.title
    if (selectedFields.description) data.description = extractionResult.value.description
    if (selectedFields.tags) data.tags = extractionResult.value.tags
    if (selectedFields.content) data.content = extractionResult.value.content
    
    emit('apply', data)
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
      <!-- STEP 1: CHAT -->
      <template v-if="step === 1">
        <!-- Context Block (Compact) -->
        <UCollapsible v-if="content || (sourceTexts && sourceTexts.length > 0)" class="mb-4">
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            class="w-full justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50"
          >
            <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <UIcon name="i-heroicons-document-text" class="w-4 h-4" />
              {{ t('llm.context') }}
              <span v-if="useContent || selectedSourceTexts.size > 0" class="text-xs font-normal text-primary">
                ({{ (useContent ? 1 : 0) + selectedSourceTexts.size }} {{ t('common.selected') }})
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
          </template>
        </UCollapsible>

        <!-- Chat Area -->
        <div 
          class="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto mb-4 border border-gray-200 dark:border-gray-700/50 rounded-lg bg-gray-50/30 dark:bg-gray-900/10 p-4 space-y-4"
          ref="chatContainer"
        >
          <div v-if="chatMessages.length === 0" class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 opacity-60">
             <UIcon name="i-heroicons-chat-bubble-left-right" class="w-12 h-12 mb-2" />
             <p class="text-sm">{{ t('llm.chatEmpty', 'Start chatting with AI to generate content') }}</p>
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

        <!-- Template Selector -->
        <div v-if="templateOptions.length > 1" class="mb-4">
          <USelectMenu
            v-model="selectedTemplateId"
            :items="templateOptions"
            value-key="value"
            label-key="label"
            :loading="isLoadingTemplates"
            :disabled="isGenerating"
            :placeholder="t('llm.selectTemplate')"
            class="w-full"
          />
        </div>

        <!-- Chat Input -->
        <div class="relative">
          <UTextarea
            v-model="prompt"
            :placeholder="t('llm.promptPlaceholder')"
            :rows="3"
            autoresize
            :disabled="isGenerating || isRecording || isTranscribing"
            class="w-full pr-12"
            @keydown.enter.prevent="handleGenerate"
          />
          
          <div class="absolute bottom-2 right-2 flex items-center gap-1.5">
            <UButton
              icon="i-heroicons-microphone"
              :color="isRecording ? 'red' : 'gray'"
              variant="ghost"
              size="sm"
              :disabled="isGenerating || isTranscribing"
              @click="handleVoiceRecording"
            />
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
           <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 text-primary animate-spin" />
           <p class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ t('llm.processingParameters', 'Generating publication parameters...') }}</p>
        </div>
        
        <div v-else-if="extractionResult" class="space-y-6">
           <p class="text-sm text-gray-500 mb-4">{{ t('llm.selectFieldsToApply', 'Select which fields you want to update in the publication:') }}</p>
           
           <!-- Title -->
           <div class="space-y-2">
              <div class="flex items-center justify-between">
                <UCheckbox v-model="selectedFields.title" :label="t('post.title')" />
              </div>
              <UInput v-if="selectedFields.title" v-model="extractionResult.title" readonly class="bg-white dark:bg-gray-800" />
           </div>

           <!-- Description -->
           <div class="space-y-2">
              <div class="flex items-center justify-between">
                <UCheckbox v-model="selectedFields.description" :label="t('post.description')" />
              </div>
              <UTextarea v-if="selectedFields.description" v-model="extractionResult.description" readonly autoresize :rows="2" />
           </div>

           <!-- Tags -->
           <div class="space-y-2">
              <div class="flex items-center justify-between">
                <UCheckbox v-model="selectedFields.tags" :label="t('post.tags')" />
              </div>
              <div v-if="selectedFields.tags" class="p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 flex flex-wrap gap-1.5">
                 <span v-for="tag in extractionResult.tags.split(',')" :key="tag" class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-xxs rounded text-gray-600 dark:text-gray-400 font-mono">
                   #{{ tag.trim() }}
                 </span>
                 <span v-if="!extractionResult.tags" class="text-xs text-gray-400 italic">{{ t('common.none') }}</span>
              </div>
           </div>

           <!-- Content -->
           <div class="space-y-2">
              <div class="flex items-center justify-between">
                <UCheckbox v-model="selectedFields.content" :label="t('post.contentLabel')" />
              </div>
              <UTextarea v-if="selectedFields.content" v-model="extractionResult.content" readonly autoresize :rows="5" class="font-mono text-xs" />
           </div>

            <!-- Advanced Settings (Step 2) -->
            <div class="pt-4 border-t border-gray-100 dark:border-gray-700">
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="sm"
                  :icon="showAdvanced ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  @click="showAdvanced = !showAdvanced"
                >
                  {{ t('llm.advancedSettings') }}
                </UButton>

                <div v-if="showAdvanced" class="mt-4 grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <UFormField :label="t('llm.temperature')">
                        <UInput v-model.number="temperature" type="number" step="0.1" min="0" max="2" size="sm" />
                    </UFormField>
                    <UFormField :label="t('llm.maxTokens')">
                        <UInput v-model.number="maxTokens" type="number" min="100" max="8000" size="sm" />
                    </UFormField>
                    <div class="col-span-2">
                        <UButton block size="sm" variant="soft" @click="handleGenerationStep2(chatMessages.length > 0 ? chatMessages[chatMessages.length-1]?.content || '' : (content || ''))">
                            {{ t('llm.regenerate', 'Regenerate Parameters') }}
                        </UButton>
                    </div>
                </div>
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
           <UButton
            color="neutral"
            variant="soft"
            @click="handleSkip"
          >
            {{ t('common.skip') }}
          </UButton>
          <UButton
            color="primary"
            class="min-w-[100px]"
            :disabled="!chatMessages.some(m => m.role === 'assistant')"
            @click="handleNext"
          >
            {{ t('common.next') }}
          </UButton>
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
          icon="i-heroicons-check"
          @click="handleInsert"
        >
          {{ t('common.apply') }}
        </UButton>
      </div>
    </template>
  </UiAppModal>
</template>
