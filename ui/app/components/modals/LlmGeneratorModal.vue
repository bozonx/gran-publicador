<script setup lang="ts">
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'

interface Emits {
  (e: 'insert', content: string): void
  (e: 'close'): void
}

const emit = defineEmits<Emits>()
const { t } = useI18n()
const toast = useToast()
const { generateContent, isGenerating, error } = useLlm()

const isOpen = defineModel<boolean>('open', { required: true })

// Form state
const prompt = ref('')
const result = ref('')
const showAdvanced = ref(false)
const temperature = ref(0.7)
const maxTokens = ref(2000)

// Metadata from last generation
const metadata = ref<any>(null)

// Reset form when modal closes
watch(isOpen, (open) => {
  if (!open) {
    prompt.value = ''
    result.value = ''
    metadata.value = null
    showAdvanced.value = false
  }
})

async function handleGenerate() {
  console.log('Modal: handleGenerate clicked');
  if (!prompt.value.trim()) {
    console.log('Modal: Prompt is empty');
    toast.add({
      title: t('llm.promptRequired'),
      color: 'red',
    });
    return;
  }

  console.log('Modal: Calling generateContent');
  const response = await generateContent(prompt.value, {
    temperature: temperature.value,
    max_tokens: maxTokens.value,
  });

  if (response) {
    console.log('Modal: Response received', response);
    result.value = response.content;
    metadata.value = response._router || null;
  } else {
    console.log('Modal: No response (error)');
    toast.add({
      title: t('llm.error'),
      description: error.value || t('llm.errorMessage'),
      color: 'red',
    });
  }
}

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
    <template #title>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-primary" />
        <span>{{ t('llm.generate') }}</span>
      </div>
    </template>
    <div :class="FORM_SPACING.section">
      <!-- Prompt Input -->
      <UFormField :label="t('llm.promptLabel')" required>
        <UTextarea
          v-model="prompt"
          :placeholder="t('llm.promptPlaceholder')"
          :rows="4"
          autoresize
          :disabled="isGenerating"
          class="w-full"
        />
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
          :disabled="!prompt.trim()"
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
        :disabled="isGenerating"
        @click="handleClose"
      >
        {{ t('common.cancel') }}
      </UButton>
      <UButton
        color="primary"
        :disabled="!result || isGenerating"
        @click="handleInsert"
      >
        {{ t('llm.insertContent') }}
      </UButton>
    </template>
  </UiAppModal>
</template>
