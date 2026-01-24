<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Markdown } from '@tiptap/markdown'
import { BubbleMenu as BubbleMenuExtension } from '@tiptap/extension-bubble-menu'
import MarkdownIt from 'markdown-it'
import { useStt } from '~/composables/useStt'

interface Props {
  /** Initial content (Markdown) */
  modelValue?: string
  /** Placeholder text */
  placeholder?: string
  /** Maximum character count */
  maxLength?: number
  /** Whether the editor is disabled */
  disabled?: boolean
  /** Minimum height in pixels */
  minHeight?: number
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'blur' | 'focus'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Write something...',
  maxLength: undefined,
  disabled: false,
  minHeight: 200,
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
})

const linkUrlInput = ref('')
const isLinkMenuOpen = ref(false)

// STT Integration
const { 
  isRecording, 
  recordingDuration, 
  isTranscribing, 
  start: startStt, 
  stop: stopStt,
  error: sttError,
  recorderError
} = useStt()

// Watch for STT errors
watch([sttError, recorderError], ([newSttError, newRecorderError]) => {
  if (newSttError) {
    toast.add({
      title: t('common.error'),
      description: t(`llm.${newSttError}`, 'Transcription error'),
      color: 'error'
    })
  }
  if (newRecorderError) {
    toast.add({
      title: t('common.error'),
      description: t(`llm.${newRecorderError}`, 'Microphone error'),
      color: 'error'
    })
  }
})

async function toggleRecording() {
  if (isRecording.value) {
    const text = await stopStt()
    if (text && editor.value) {
      editor.value.commands.insertContent(' ' + text)
    }
  } else {
    await startStt()
  }
}

const formattedDuration = computed(() => {
  const mins = Math.floor(recordingDuration.value / 60)
  const secs = recordingDuration.value % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

// Extensions
const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
  }),
  Markdown.configure({
    html: false,
    transformPastedText: true,
    transformCopiedText: true,
  }),
  Underline,
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    HTMLAttributes: {
      class: 'text-primary-600 dark:text-primary-400 underline cursor-pointer',
    },
  }),
  BubbleMenuExtension,
  Placeholder.configure({
    placeholder: props.placeholder,
  }),
  props.maxLength
    ? CharacterCount.configure({ limit: props.maxLength })
    : CharacterCount,
]

const editor = useEditor({
  content: props.modelValue ? md.render(props.modelValue) : '',
  editable: !props.disabled,
  extensions: extensions,
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getMarkdown())
  },
  onBlur: () => {
    emit('blur')
  },
  onFocus: () => {
    emit('focus')
  },
})

// Watch for external content changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (editor.value) {
      const currentMarkdown = editor.value.getMarkdown()
      if (newValue !== currentMarkdown) {
        const html = md.render(newValue || '')
        editor.value.commands.setContent(html, { emitUpdate: false })
      }
    }
  }
)

// Watch for disabled changes
watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled)
  }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

/**
 * Commands
 */
function setLink() {
  if (editor.value?.isActive('link')) {
    editor.value.chain().focus().unsetLink().run()
    return
  }
  
  const previousUrl = editor.value?.getAttributes('link').href
  linkUrlInput.value = previousUrl || ''
  isLinkMenuOpen.value = true
}

function applyLink() {
  if (linkUrlInput.value) {
    editor.value?.chain().focus().extendMarkRange('link').setLink({ href: linkUrlInput.value }).run()
  } else {
    editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  }
  isLinkMenuOpen.value = false
}

function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  isLinkMenuOpen.value = false
}

const characterCount = computed(() => {
  return editor.value?.storage.characterCount.characters() || 0
})

const wordCount = computed(() => {
  return editor.value?.storage.characterCount.words() || 0
})

const isMaxLengthReached = computed(() => {
  return props.maxLength ? characterCount.value >= props.maxLength : false
})
</script>

<template>
  <div class="tiptap-editor border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col relative">
    
    <!-- Временно закомментируем BubbleMenu для проверки запуска без него -->
    <!-- <BubbleMenu
      v-if="editor"
      :editor="editor"
      :tippy-options="{ duration: 100, placement: 'top' }"
      v-show="editor.isActive('link') || isLinkMenuOpen"
    >
      ...
    </BubbleMenu> -->

    <!-- Toolbar -->
    <div
      v-if="editor && !disabled"
      class="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
    >
      <!-- Text formatting -->
      <div class="flex items-center gap-0.5">
        <UButton
          :color="editor.isActive('bold') ? 'primary' : 'neutral'"
          :variant="editor.isActive('bold') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-bold"
          :disabled="!editor.can().chain().focus().toggleBold().run()"
          @click="editor.chain().focus().toggleBold().run()"
        ></UButton>
        <UButton
          :color="editor.isActive('italic') ? 'primary' : 'neutral'"
          :variant="editor.isActive('italic') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-italic"
          :disabled="!editor.can().chain().focus().toggleItalic().run()"
          @click="editor.chain().focus().toggleItalic().run()"
        ></UButton>
        <UButton
          :color="editor.isActive('strike') ? 'primary' : 'neutral'"
          :variant="editor.isActive('strike') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-strikethrough"
          :disabled="!editor.can().chain().focus().toggleStrike().run()"
          @click="editor.chain().focus().toggleStrike().run()"
        ></UButton>
        <UButton
          :color="editor.isActive('underline') ? 'primary' : 'neutral'"
          :variant="editor.isActive('underline') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-underline"
          :disabled="!editor.can().chain().focus().toggleUnderline().run()"
          @click="editor.chain().focus().toggleUnderline().run()"
        ></UButton>
        <UButton
          :color="editor.isActive('code') ? 'primary' : 'neutral'"
          :variant="editor.isActive('code') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-code-bracket"
          :disabled="!editor.can().chain().focus().toggleCode().run()"
          @click="editor.chain().focus().toggleCode().run()"
        ></UButton>
      </div>

      <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

      <!-- Headings -->
      <div class="flex items-center gap-0.5">
        <UButton
          :color="editor.isActive('heading', { level: 1 }) ? 'primary' : 'neutral'"
          :variant="editor.isActive('heading', { level: 1 }) ? 'solid' : 'ghost'"
          size="xs"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          H1
        </UButton>
        <UButton
          :color="editor.isActive('heading', { level: 2 }) ? 'primary' : 'neutral'"
          :variant="editor.isActive('heading', { level: 2 }) ? 'solid' : 'ghost'"
          size="xs"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          H2
        </UButton>
        <UButton
          :color="editor.isActive('heading', { level: 3 }) ? 'primary' : 'neutral'"
          :variant="editor.isActive('heading', { level: 3 }) ? 'solid' : 'ghost'"
          size="xs"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          H3
        </UButton>
      </div>

      <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

      <!-- Lists -->
      <div class="flex items-center gap-0.5">
        <UButton
          :color="editor.isActive('bulletList') ? 'primary' : 'neutral'"
          :variant="editor.isActive('bulletList') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-list-bullet"
          @click="editor.chain().focus().toggleBulletList().run()"
        ></UButton>
        <UButton
          :color="editor.isActive('orderedList') ? 'primary' : 'neutral'"
          :variant="editor.isActive('orderedList') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-numbered-list"
          @click="editor.chain().focus().toggleOrderedList().run()"
        ></UButton>
      </div>

      <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

      <!-- Block elements -->
      <div class="flex items-center gap-0.5">
        <UButton
          :color="editor.isActive('blockquote') ? 'primary' : 'neutral'"
          :variant="editor.isActive('blockquote') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-chat-bubble-bottom-center-text"
          @click="editor.chain().focus().toggleBlockquote().run()"
        ></UButton>
        <UButton
          :color="editor.isActive('codeBlock') ? 'primary' : 'neutral'"
          :variant="editor.isActive('codeBlock') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-command-line"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        ></UButton>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-heroicons-minus"
          @click="editor.chain().focus().setHorizontalRule().run()"
        ></UButton>
      </div>

      <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

      <!-- Link & Tools -->
      <div class="flex items-center gap-0.5">
        <UButton
          :color="editor.isActive('link') ? 'primary' : 'neutral'"
          :variant="editor.isActive('link') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-link"
          @click="setLink"
        ></UButton>
        
        <!-- STT/Voice Recorder -->
        <UTooltip :text="isRecording ? t('common.stopRecording') : t('common.startRecording')">
          <UButton
            :color="isRecording ? 'error' : isTranscribing ? 'warning' : 'neutral'"
            :variant="isRecording ? 'solid' : 'ghost'"
            size="xs"
            :icon="isTranscribing ? 'i-heroicons-arrow-path' : (isRecording ? 'i-heroicons-stop' : 'i-heroicons-microphone')"
            :loading="isTranscribing"
            @click="toggleRecording"
          >
            <span v-if="isRecording" class="ml-1 text-[10px] font-mono">{{ formattedDuration }}</span>
          </UButton>
        </UTooltip>
      </div>

      <div class="flex-1"></div>

      <!-- Undo/Redo -->
      <div class="flex items-center gap-0.5">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-heroicons-arrow-uturn-left"
          :disabled="!editor.can().chain().focus().undo().run()"
          @click="editor.chain().focus().undo().run()"
        ></UButton>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-heroicons-arrow-uturn-right"
          :disabled="!editor.can().chain().focus().redo().run()"
          @click="editor.chain().focus().redo().run()"
        ></UButton>
      </div>
    </div>

    <!-- Editor content -->
    <EditorContent
      :editor="editor"
      class="prose prose-sm dark:prose-invert max-w-none p-4 focus:outline-none overflow-y-auto"
      :style="{ minHeight: `${minHeight}px` }"
    ></EditorContent>

    <!-- Footer with character count -->
    <div
      v-if="editor"
      class="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400"
    >
      <div class="flex items-center gap-4">
        <span>{{ characterCount }} {{ t('editor.characters', 'characters') }}</span>
        <span>{{ wordCount }} {{ t('editor.words', 'words') }}</span>
      </div>
      <div v-if="maxLength">
        <span :class="{ 'text-red-500': isMaxLengthReached }">
          {{ characterCount }} / {{ maxLength }}
        </span>
      </div>
    </div>
  </div>
</template>

<style>
/* ... Styles stay the same ... */
</style>
