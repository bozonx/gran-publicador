<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
// @ts-expect-error: Tiptap vue-3 exports are messy in this version
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Markdown } from '@tiptap/markdown'
import { BubbleMenu as BubbleMenuExtension } from '@tiptap/extension-bubble-menu'
import { common, createLowlight } from 'lowlight'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useStt } from '~/composables/useStt'
import MarkdownIt from 'markdown-it'

const lowlight = createLowlight(common)
const md = new MarkdownIt({
  html: true,
  breaks: true,
})

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

const linkUrlInput = ref('')
const isLinkMenuOpen = ref(false)
const isSourceMode = ref(false)

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
    codeBlock: false,
  }),
  Markdown.configure({
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
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: 'javascript',
  }),
  CharacterCount.configure({ 
    limit: props.maxLength 
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
]

const editor = useEditor({
  editable: !props.disabled,
  extensions: extensions,
  onUpdate: ({ editor }) => {
    const markdown = editor.getMarkdown()
    if (markdown !== props.modelValue) {
      emit('update:modelValue', markdown)
    }
  },
  onCreate: ({ editor }) => {
    if (props.modelValue) {
      editor.commands.setContent(md.render(props.modelValue), { emitUpdate: false })
    }
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
        editor.value.commands.setContent(md.render(newValue || ''), { emitUpdate: false })
      }
    }
  }
)

// Watch for maxLength changes
watch(
  () => props.maxLength,
  (limit) => {
    editor.value?.extensionManager.extensions.find(e => e.name === 'characterCount')?.configure({ limit })
  }
)

// Watch for placeholder changes
watch(
  () => props.placeholder,
  (placeholder) => {
    editor.value?.extensionManager.extensions.find(e => e.name === 'placeholder')?.configure({ placeholder })
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

function insertTable() {
  // @ts-expect-error: Table extension types not automatically inferred
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
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
    
    <!-- BubbleMenu for Links -->
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :tippy-options="{ duration: 100, placement: 'top' }"
      v-show="editor.isActive('link') || isLinkMenuOpen"
    >
      <div class="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl">
        <UInput
          v-model="linkUrlInput"
          size="xs"
          placeholder="https://..."
          class="w-48"
          @keydown.enter="applyLink"
        />
        <UButton
          size="xs"
          color="primary"
          @click="applyLink"
        >
          OK
        </UButton>
        <UButton
          v-if="editor.isActive('link')"
          size="xs"
          icon="i-heroicons-trash"
          color="error"
          variant="ghost"
          @click="removeLink"
        />
      </div>
    </BubbleMenu>

    <!-- BubbleMenu for Tables -->
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :tippy-options="{ duration: 100, placement: 'bottom' }"
      :should-show="({ editor }) => editor.isActive('table')"
    >
      <div class="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-x-auto max-w-[90vw]">
        <UTooltip :text="t('editor.table.addColumnBefore', 'Add column before')">
          <UButton size="xs" variant="ghost" icon="i-heroicons-plus-circle" @click="editor.chain().focus().addColumnBefore().run()" />
        </UTooltip>
        <UTooltip :text="t('editor.table.addColumnAfter', 'Add column after')">
          <UButton size="xs" variant="ghost" icon="i-heroicons-plus-circle" class="rotate-90" @click="editor.chain().focus().addColumnAfter().run()" />
        </UTooltip>
        <UTooltip :text="t('editor.table.deleteColumn', 'Delete column')">
          <UButton size="xs" variant="ghost" icon="i-heroicons-trash" color="error" @click="editor.chain().focus().deleteColumn().run()" />
        </UTooltip>
        <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
        <UTooltip :text="t('editor.table.addRowBefore', 'Add row before')">
          <UButton size="xs" variant="ghost" icon="i-heroicons-bars-3-bottom-left" @click="editor.chain().focus().addRowBefore().run()" />
        </UTooltip>
        <UTooltip :text="t('editor.table.addRowAfter', 'Add row after')">
          <UButton size="xs" variant="ghost" icon="i-heroicons-bars-3-bottom-right" @click="editor.chain().focus().addRowAfter().run()" />
        </UTooltip>
        <UTooltip :text="t('editor.table.deleteRow', 'Delete row')">
          <UButton size="xs" variant="ghost" icon="i-heroicons-trash" color="error" @click="editor.chain().focus().deleteRow().run()" />
        </UTooltip>
        <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
        <UTooltip :text="t('editor.table.mergeCells', 'Merge cells')">
          <UButton size="xs" variant="ghost" icon="i-heroicons-arrows-pointing-in" @click="editor.chain().focus().mergeCells().run()" />
        </UTooltip>
        <UTooltip :text="t('editor.table.splitCell', 'Split cell')">
          <UButton size="xs" variant="ghost" icon="i-heroicons-arrows-pointing-out" @click="editor.chain().focus().splitCell().run()" />
        </UTooltip>
        <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
        <UTooltip :text="t('editor.table.deleteTable', 'Delete table')">
          <UButton size="xs" variant="ghost" icon="i-heroicons-trash" color="error" @click="editor.chain().focus().deleteTable().run()" />
        </UTooltip>
      </div>
    </BubbleMenu>

    <!-- Toolbar -->
    <div
      v-if="editor && !disabled"
      class="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
    >
      <!-- Source Mode Toggle (Always visible) -->
      <UButton
        :color="isSourceMode ? 'primary' : 'neutral'"
        :variant="isSourceMode ? 'solid' : 'ghost'"
        size="xs"
        icon="i-heroicons-code-bracket-square"
        @click="isSourceMode = !isSourceMode"
      >
        MD
      </UButton>

      <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

      <!-- Text formatting -->
      <div v-if="!isSourceMode" class="flex items-center gap-0.5">
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

      <div v-if="!isSourceMode" class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

      <!-- Headings -->
      <div v-if="!isSourceMode" class="flex items-center gap-0.5">
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

      <div v-if="!isSourceMode" class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

      <!-- Lists -->
      <div v-if="!isSourceMode" class="flex items-center gap-0.5">
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

      <div v-if="!isSourceMode" class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

      <!-- Block elements -->
      <div v-if="!isSourceMode" class="flex items-center gap-0.5">
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

      <div v-if="!isSourceMode" class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

      <!-- Link & Tools -->
      <div v-if="!isSourceMode" class="flex items-center gap-0.5">
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

        <UButton
          :color="editor.isActive('table') ? 'primary' : 'neutral'"
          :variant="editor.isActive('table') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-table-cells"
          @click="insertTable"
        ></UButton>
      </div>

      <div class="flex-1"></div>

      <!-- Undo/Redo -->
      <div v-if="!isSourceMode" class="flex items-center gap-0.5">
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
    <div class="relative flex-1">
      <EditorContent
        v-show="!isSourceMode"
        :editor="editor"
        class="prose prose-sm dark:prose-invert max-w-none p-4 focus:outline-none overflow-y-auto"
        :style="{ minHeight: `${minHeight}px` }"
      ></EditorContent>
      
      <textarea
        v-if="isSourceMode"
        :value="modelValue"
        class="w-full h-full p-4 font-mono text-sm bg-transparent border-none outline-none resize-none text-gray-800 dark:text-gray-200"
        :style="{ minHeight: `${minHeight}px` }"
        placeholder="Markdown source..."
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
    </div>

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
@reference "../../assets/css/main.css";

.tiptap {
  &:focus {
    outline: none;
  }

  p.is-editor-empty:first-child::before {
    color: var(--ui-color-neutral-400);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  pre {
    @apply bg-gray-900 text-gray-100 rounded-md p-4 my-4 font-mono text-sm overflow-x-auto;
    
    code {
      @apply bg-transparent p-0 text-inherit;
    }

    /* Syntax highlighting */
    .hljs-comment,
    .hljs-quote {
      @apply text-gray-500 italic;
    }

    .hljs-keyword,
    .hljs-selector-tag,
    .hljs-addition {
      @apply text-purple-400;
    }

    .hljs-number,
    .hljs-string,
    .hljs-meta .hljs-meta-string,
    .hljs-literal,
    .hljs-doctag,
    .hljs-regexp {
      @apply text-green-400;
    }

    .hljs-attribute,
    .hljs-attr,
    .hljs-variable,
    .hljs-template-variable,
    .hljs-class .hljs-title,
    .hljs-type {
      @apply text-yellow-300;
    }

    .hljs-symbol,
    .hljs-bullet,
    .hljs-subst,
    .hljs-meta,
    .hljs-link {
      @apply text-blue-400;
    }

    .hljs-built_in,
    .hljs-deletion {
      @apply text-red-400;
    }

    .hljs-formula {
      @apply bg-gray-800 italic;
    }

    .hljs-emphasis {
      @apply italic;
    }

    .hljs-strong {
      @apply font-bold;
    }
  }

  ul {
    @apply list-disc ml-4;
  }

  ol {
    @apply list-decimal ml-4;
  }

  blockquote {
    @apply border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-4;
  }

  hr {
    @apply border-t border-gray-200 dark:border-gray-700 my-6;
  }

  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    margin: 1rem 0;
    overflow: hidden;

    td,
    th {
      min-width: 1em;
      @apply border border-gray-300 dark:border-gray-600;
      padding: 0.5rem;
      vertical-align: top;
      box-sizing: border-box;
      position: relative;

      > * {
        margin-bottom: 0;
      }
    }

    th {
      font-weight: bold;
      text-align: left;
      @apply bg-gray-100 dark:bg-gray-800;
    }

    .selectedCell:after {
      z-index: 2;
      position: absolute;
      content: "";
      left: 0; right: 0; top: 0; bottom: 0;
      @apply bg-primary-500/10 pointer-events-none;
    }

    .column-resize-handle {
      position: absolute;
      right: -2px;
      top: 0;
      bottom: -2px;
      width: 4px;
      @apply bg-primary-400 pointer-events-none;
    }

    p {
      margin: 0;
    }
  }

  .tableWrapper {
    overflow-x: auto;
  }

  .resize-cursor {
    cursor: ew-resize;
    cursor: col-resize;
  }
}
</style>
