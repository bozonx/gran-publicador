<script setup lang="ts">
interface Props {
  modelValue: string
  isGenerating?: boolean
  isRecording?: boolean
  isTranscribing?: boolean
  disabled?: boolean
  estimatedTokens?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'send'): void
  (e: 'stop'): void
  (e: 'voice'): void
  (e: 'cancelVoice'): void
}>()

const { t } = useI18n()
const isSttHovered = ref(false)

function handleInput(v: string) {
  emit('update:modelValue', v)
}

function handleSend() {
  if (!props.modelValue.trim() || props.disabled) return
  emit('send')
}
</script>

<template>
  <div class="relative">
    <UTextarea
      :model-value="modelValue"
      :placeholder="t('llm.promptPlaceholder')"
      :rows="3"
      autoresize
      :disabled="isGenerating || isRecording || isTranscribing || disabled"
      class="w-full pr-12"
      @update:model-value="handleInput"
      @keydown.ctrl.enter="handleSend"
    />
    
    <div class="absolute bottom-2 right-2 flex flex-col items-center gap-1.5">
      <!-- STT Button -->
      <UTooltip :text="isRecording ? t('common.stop') : (isTranscribing ? t('common.cancel') : t('llm.voiceInputAppend'))">
        <UButton
          v-if="isTranscribing"
          :icon="isSttHovered ? 'i-heroicons-x-mark' : 'i-heroicons-arrow-path'"
          :color="isSttHovered ? 'error' : 'primary'"
          variant="ghost"
          size="sm"
          :class="{ 'animate-spin': !isSttHovered }"
          @click="emit('cancelVoice')"
          @mouseenter="isSttHovered = true"
          @mouseleave="isSttHovered = false"
        />
        <UButton
          v-else
          :icon="isRecording ? 'i-heroicons-stop' : 'i-heroicons-microphone'"
          :color="isRecording ? 'error' : 'neutral'"
          :variant="isRecording ? 'solid' : 'ghost'"
          size="sm"
          :disabled="isGenerating || disabled"
          @click="emit('voice')"
        />
      </UTooltip>

      <!-- Send/Stop Generation Button -->
      <UButton
        v-if="isGenerating"
        icon="i-heroicons-x-mark"
        color="neutral"
        variant="solid"
        size="sm"
        @click="emit('stop')"
      />
      <UButton
        v-else
        icon="i-heroicons-paper-airplane"
        :disabled="!modelValue.trim() || isRecording || isTranscribing || disabled"
        @click="handleSend"
      />
    </div>
  </div>
</template>
