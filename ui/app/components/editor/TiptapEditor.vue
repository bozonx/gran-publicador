<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'

interface Props {
  /** Initial content (HTML) */
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

// Extensions defined outside to avoid duplication issues during ref initialization
const extensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: 'text-primary-600 dark:text-primary-400 underline',
    },
  }),
  Placeholder.configure({
    placeholder: props.placeholder,
  }),
  props.maxLength
    ? CharacterCount.configure({ limit: props.maxLength })
    : CharacterCount,
]

const editor = useEditor({
  content: props.modelValue,
  editable: !props.disabled,
  extensions: extensions,
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
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
    if (editor.value && newValue !== editor.value.getHTML()) {
      editor.value.commands.setContent(newValue, { emitUpdate: false })
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

// Cleanup
onBeforeUnmount(() => {
  editor.value?.destroy()
})

/**
 * Set link URL
 */
function setLink() {
  const previousUrl = editor.value?.getAttributes('link').href
  const url = window.prompt('URL', previousUrl)

  if (url === null) return

  if (url === '') {
    editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

/**
 * Get character count
 */
const characterCount = computed(() => {
  return editor.value?.storage.characterCount.characters() || 0
})

/**
 * Get word count
 */
const wordCount = computed(() => {
  return editor.value?.storage.characterCount.words() || 0
})

/**
 * Check if max length reached
 */
const isMaxLengthReached = computed(() => {
  return props.maxLength ? characterCount.value >= props.maxLength : false
})
</script>

<template>
  <div class="tiptap-editor border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col">
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

      <!-- Link -->
      <UButton
        :color="editor.isActive('link') ? 'primary' : 'neutral'"
        :variant="editor.isActive('link') ? 'solid' : 'ghost'"
        size="xs"
        icon="i-heroicons-link"
        @click="setLink"
      ></UButton>

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
/* Tiptap editor styles */
.tiptap-editor .ProseMirror {
  outline: none;
  min-height: inherit;
}

.tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}

.tiptap-editor .ProseMirror:focus {
  outline: none;
}

/* Dark mode placeholder */
.dark .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
  color: #6b7280;
}

/* Code block styling */
.tiptap-editor .ProseMirror pre {
  background: #1e1e1e;
  border-radius: 0.5rem;
  color: #f8f8f2;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 0.75rem 1rem;
}

.tiptap-editor .ProseMirror pre code {
  background: none;
  color: inherit;
  font-size: 0.875rem;
  padding: 0;
}

/* Inline code styling */
.tiptap-editor .ProseMirror code {
  background-color: #f3f4f6;
  border-radius: 0.25rem;
  color: #dc2626;
  font-size: 0.875em;
  padding: 0.125rem 0.25rem;
}

.dark .tiptap-editor .ProseMirror code {
  background-color: #374151;
  color: #fca5a5;
}

/* Blockquote styling */
.tiptap-editor .ProseMirror blockquote {
  border-left: 4px solid #e5e7eb;
  margin: 1rem 0;
  padding-left: 1rem;
}

.dark .tiptap-editor .ProseMirror blockquote {
  border-left-color: #4b5563;
}

/* Horizontal rule */
.tiptap-editor .ProseMirror hr {
  border: none;
  border-top: 2px solid #e5e7eb;
  margin: 2rem 0;
}

.dark .tiptap-editor .ProseMirror hr {
  border-top-color: #4b5563;
}
</style>
