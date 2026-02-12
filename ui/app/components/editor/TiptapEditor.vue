<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Markdown } from '@tiptap/markdown'
import Link from '@tiptap/extension-link'
import { common, createLowlight } from 'lowlight'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useStt } from '~/composables/useStt'
import { useEditorTextActions } from '~/composables/useEditorTextActions'

const lowlight = createLowlight(common)

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
  /** Default target language for translation modal */
  defaultTargetLang?: string
  /** Project ID for LLM context and templates */
  projectId?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'blur' | 'focus'): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: undefined,
  maxLength: undefined,
  disabled: false,
  minHeight: 200,
  defaultTargetLang: undefined,
  projectId: undefined,
})

const emit = defineEmits<Emits>()

const { t } = useI18n()
const toast = useToast()

const resolvedPlaceholder = computed(() => props.placeholder ?? t('editor.placeholder', 'Write something...'))
const linkUrlInput = ref('')
const isLinkMenuOpen = ref(false)
const linkMenuAnchor = ref<{ from: number; to: number } | null>(null)
const isSourceMode = ref(false)
const isTranslateModalOpen = ref(false)
const isQuickGenModalOpen = ref(false)

// STT Integration
const { 
  isRecording, 
  recordingDuration, 
  isTranscribing, 
  start: startStt, 
  stop: stopStt,
  cancel: cancelStt,
  error: sttError,
  recorderError
} = useStt()

const sttSelection = ref<{ from: number; to: number } | null>(null)

// Watch for STT errors — reset local state and notify user
watch([sttError, recorderError], ([newSttError, newRecorderError]) => {
  if (newSttError && newSttError !== 'cancelled') {
    sttSelection.value = null
    toast.add({
      title: t('common.error'),
      description: t(`llm.${newSttError}`, 'Transcription error'),
      color: 'error'
    })
  }
  if (newRecorderError) {
    sttSelection.value = null
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
      const e = editor.value
      const docSize = e.state.doc.content.size
      const sel = sttSelection.value

      // Restore cursor position, clamping to current document bounds
      if (sel) {
        const from = Math.min(sel.from, docSize)
        const to = Math.min(sel.to, docSize)
        e.commands.setTextSelection({ from, to })
      }

      e.commands.focus()

      // Insert as plain text to avoid creating a new paragraph, replacing selection if any
      const { from, to } = e.state.selection
      const needsSpace = from > 1 && !/\s$/.test(e.state.doc.textBetween(Math.max(0, from - 1), from))
      const tr = e.state.tr.insertText(needsSpace ? ' ' + text : text, from, to)
      e.view.dispatch(tr)
    }
    sttSelection.value = null
  } else {
    if (editor.value) {
      const { from, to } = editor.value.state.selection
      sttSelection.value = { from, to }
    }
    await startStt()
  }
}

function handleCancelStt() {
  cancelStt()
  sttSelection.value = null
}

const formattedDuration = computed(() => {
  const mins = Math.floor(recordingDuration.value / 60)
  const secs = recordingDuration.value % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

// Build extensions reactively so watchers can update individual configs
function buildExtensions(opts: { placeholder: string; maxLength?: number }) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        class: 'text-primary-600 dark:text-primary-400 underline cursor-pointer',
      },
    }),
    Markdown.configure({
      transformPastedText: true,
      transformCopiedText: true,
      markedOptions: {
        gfm: true,
        breaks: false,
      },
    }),
    Placeholder.configure({
      placeholder: () => resolvedPlaceholder.value,
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'javascript',
    }),
    CharacterCount.configure({
      limit: props.maxLength,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ]
}

const editor = useEditor({
  content: props.modelValue || '',
  contentType: 'markdown',
  editable: !props.disabled,
  extensions: buildExtensions({ placeholder: resolvedPlaceholder.value, maxLength: props.maxLength }),
  editorProps: {
    attributes: {
      class: 'tiptap focus:outline-none',
    },
    transformPastedHTML(html: string) {
      const allowedTags = new Set([
        'p', 'br', 'strong', 'b', 'em', 'i', 's', 'del',
        'a', 'code', 'pre', 'blockquote',
        'ul', 'ol', 'li',
        'h1', 'h2', 'h3',
        'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ])
      const doc = new DOMParser().parseFromString(html, 'text/html')
      function clean(el: Element) {
        for (const child of Array.from(el.children)) {
          if (!allowedTags.has(child.tagName.toLowerCase())) {
            child.replaceWith(...Array.from(child.childNodes))
          } else {
            for (const attr of Array.from(child.attributes)) {
              if (!(child.tagName === 'A' && attr.name === 'href')) {
                child.removeAttribute(attr.name)
              }
            }
            clean(child)
          }
        }
      }
      clean(doc.body)
      return doc.body.innerHTML
    },
  },
  onUpdate: ({ editor }) => {
    const markdown = editor.getMarkdown()
    if (markdown !== props.modelValue) {
      emit('update:modelValue', markdown)
    }
  },
  onSelectionUpdate: ({ editor }) => {
    if (isSourceMode.value) return

    const { from, to, empty } = editor.state.selection
    const hrefNearCursor = getLinkHrefNearCursor(editor)
    const isInLink = editor.isActive('link') || hrefNearCursor !== null

    // Close link menu when cursor leaves the link
    if (isLinkMenuOpen.value && !isInLink) {
      isLinkMenuOpen.value = false
      linkUrlInput.value = ''
      linkMenuAnchor.value = null
      return
    }

    // Update href display when cursor moves within a link (but don't re-open)
    if (isLinkMenuOpen.value && isInLink) {
      linkUrlInput.value = hrefNearCursor ?? linkUrlInput.value
      return
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
        editor.value.commands.setContent(newValue || '', { emitUpdate: false, contentType: 'markdown' })
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

/**
 * Commands
 */
function setLink() {
  if (!editor.value) return

  const { from, to, empty } = editor.value.state.selection
  const previousUrl = editor.value.getAttributes('link').href
  const isInLink = editor.value.isActive('link') || getLinkHrefNearCursor(editor.value) !== null

  // Require either a text selection or cursor inside an existing link
  if (empty && !isInLink) {
    toast.add({
      title: t('common.info', 'Info'),
      description: t('editor.selectTextForLink', 'Select text to create a link'),
      color: 'info',
    })
    return
  }

  linkUrlInput.value = previousUrl || ''
  isLinkMenuOpen.value = true
  linkMenuAnchor.value = { from, to }

  nextTick(() => {
    editor.value?.commands.focus()
  })
}

function cancelLink() {
  isLinkMenuOpen.value = false
  linkUrlInput.value = ''
  linkMenuAnchor.value = null
  editor.value?.commands.focus()
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  // Allow mailto: and tel: protocols as-is
  if (/^(mailto:|tel:)/i.test(trimmed)) return trimmed
  // Block dangerous protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return ''
  // Add https:// if no protocol specified
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

function applyLink() {
  const href = normalizeUrl(linkUrlInput.value)
  if (href) {
    editor.value?.chain().focus().extendMarkRange('link').setLink({ href }).run()
  } else {
    editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  }
  isLinkMenuOpen.value = false
  linkMenuAnchor.value = null
}

function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  isLinkMenuOpen.value = false
  linkMenuAnchor.value = null
}

function insertTable() {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

const {
  pendingSourceText: actionSourceText,
  pendingKind: actionPendingKind,
  isActionPending: isActionPending,
  captureSelection: captureEditorSelection,
  applyResult: applyEditorResult,
  cancelAction: cancelEditorAction,
} = useEditorTextActions(editor)

const actionSplitter = computed(() => {
  return actionPendingKind.value === 'inline' ? 'off' : 'markdown'
})

function openTranslateModal() {
  const text = captureEditorSelection()
  if (!text) return
  isTranslateModalOpen.value = true
}

function handleTranslated(payload: { translatedText: string; provider: string; model?: string }) {
  applyEditorResult(payload.translatedText)
  isTranslateModalOpen.value = false
}

// Unlock editor when action modal is closed without applying result
watch([isTranslateModalOpen, isQuickGenModalOpen], ([translateOpen, quickGenOpen]) => {
  if (!translateOpen && !quickGenOpen && isActionPending.value) {
    cancelEditorAction()
  }
})

function openQuickGenModal() {
  const text = captureEditorSelection()
  if (!text) return
  isQuickGenModalOpen.value = true
}

function handleLlmGenerated(text: string) {
  applyEditorResult(text)
  isQuickGenModalOpen.value = false
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

function getLinkHrefNearCursor(editor: any): string | null {
  const directHref = editor.getAttributes('link')?.href
  if (typeof directHref === 'string' && directHref.length > 0) return directHref

  const linkMark = editor.state.schema.marks.link
  if (!linkMark) return null

  const { from, empty } = editor.state.selection
  if (!empty) return null

  const docSize = editor.state.doc.content.size

  const positionsToCheck = new Set<number>([
    from,
    Math.max(0, from - 1),
    Math.min(docSize, from + 1),
  ])

  for (const pos of positionsToCheck) {
    if (pos < 0 || pos > docSize) continue
    const $pos = editor.state.doc.resolve(pos)
    const mark = $pos.marks().find((m: any) => m.type === linkMark)
    const href = mark?.attrs?.href
    if (typeof href === 'string' && href.length > 0) return href
  }

  return null
}
</script>

<template>
  <div class="tiptap-editor border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col relative">
    
    <!-- Contextual BubbleMenu (Links only) -->
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      plugin-key="contextualBubbleMenu"
      :options="{ offset: 6, placement: 'top' }"
      :should-show="({ editor: e }) => {
        if (isSourceMode) return false
        
        // Show only if manual link edit mode is active
        return isLinkMenuOpen
      }"
    >
      <!-- Link Input UI -->
      <div 
        class="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
      >
        <UInput
          v-model="linkUrlInput"
          size="xs"
          placeholder="https://..."
          class="w-48"
          @keydown.enter="applyLink"
          @keydown.esc="cancelLink"
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
        <UButton
          v-else
          size="xs"
          icon="i-heroicons-x-mark"
          color="neutral"
          variant="ghost"
          @click="cancelLink"
        />
      </div>
    </BubbleMenu>

    <!-- BubbleMenu for Tables -->
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      plugin-key="tableBubbleMenu"
      :options="{ offset: 6, placement: 'bottom' }"
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

      <!-- Link & Table -->
      <div v-if="!isSourceMode" class="flex items-center gap-0.5">
        <UButton
          :color="(editor.isActive('link') || isLinkMenuOpen) ? 'primary' : 'neutral'"
          :variant="(editor.isActive('link') || isLinkMenuOpen) ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-link"
          @mousedown.prevent
          @click="setLink"
        ></UButton>

        <UButton
          :color="editor.isActive('table') ? 'primary' : 'neutral'"
          :variant="editor.isActive('table') ? 'solid' : 'ghost'"
          size="xs"
          icon="i-heroicons-table-cells"
          @click="insertTable"
        ></UButton>
      </div>

      <div class="flex-1"></div>

      <!-- AI Actions (Right side) -->
      <div v-if="!isSourceMode" class="flex items-center gap-0.5">
        <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        
        <UTooltip :text="t('editor.llmTooltip', 'AI generation - replaces all content or selection if cursor is placed')">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-heroicons-sparkles"
            @click="openQuickGenModal"
          />
        </UTooltip>
        
        <UTooltip :text="t('editor.translateTooltip', 'Translate - replaces all content or selection if cursor is placed')">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-heroicons-language"
            @click="openTranslateModal"
          />
        </UTooltip>
        
        <!-- STT/Voice Recorder -->
        <template v-if="isRecording || isTranscribing">
          <div class="inline-flex items-center rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <UButton
              :color="isRecording ? 'error' : 'warning'"
              :variant="isRecording ? 'soft' : 'soft'"
              size="xs"
              :icon="isTranscribing ? 'i-heroicons-arrow-path' : 'i-heroicons-stop'"
              :loading="isTranscribing"
              class="rounded-none"
              @click="toggleRecording"
            >
              <span v-if="isRecording" class="ml-1 text-xxs font-mono">{{ formattedDuration }}</span>
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              size="xs"
              icon="i-heroicons-x-mark"
              class="rounded-none border-l border-gray-200 dark:border-gray-700"
              @click="handleCancelStt"
            />
          </div>
        </template>
        <UTooltip v-else :text="t('editor.sttTooltip', 'Voice input - always inserts at cursor position')">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-heroicons-microphone"
            @click="toggleRecording"
          />
        </UTooltip>
      </div>

      <div v-if="!isSourceMode" class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>

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
        v-show="isSourceMode"
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

    <ModalsTranslateModal
      v-model:open="isTranslateModalOpen"
      :source-text="actionSourceText"
      :default-target-lang="defaultTargetLang"
      :splitter="actionSplitter"
      @translated="handleTranslated"
    />

    <ModalsLlmQuickGeneratorModal
      v-model:open="isQuickGenModalOpen"
      :selection-text="actionSourceText"
      :project-id="props.projectId"
      :post-type="(props as any).postType"
      :platforms="(props as any).platforms"
      @apply="handleLlmGenerated"
    />
  </div>
</template>

<style>
@reference "../../assets/css/main.css";

.tiptap {
  &:focus {
    outline: none;
  }

  p {
    margin: 1rem 0;
  }

  h1, h2, h3 {
    @apply font-bold mt-6 mb-2;
    line-height: 1.25;
  }

  h1 { @apply text-2xl; }
  h2 { @apply text-xl; }
  h3 { @apply text-lg; }

  strong {
    @apply font-bold;
  }

  em {
    @apply italic;
  }

  s {
    @apply line-through;
  }

  > *:first-child {
    margin-top: 0;
  }

  > *:last-child {
    margin-bottom: 0;
  }

  p.is-editor-empty:first-child::before {
    color: var(--ui-color-neutral-400);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  /* Inline code */
  :not(pre) > code {
    @apply bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 rounded px-1.5 py-0.5 text-sm font-mono;
  }

  /* Links */
  a {
    @apply text-primary-600 dark:text-primary-400 underline cursor-pointer;
    transition: opacity 0.15s;

    &:hover {
      @apply opacity-75;
    }
  }

  /*
   * Code blocks
   * Use explicit properties with !important to reliably override Tailwind Typography (.prose pre)
   */
  .ProseMirror pre,
  pre {
    background-color: rgb(249 250 251) !important;
    color: rgb(17 24 39) !important;
    border-radius: 0.375rem !important;
    padding: 1rem !important;
    margin: 1rem 0 !important;
    border: 1px solid rgb(229 231 235) !important;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.06) !important;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    font-size: 0.875rem !important;
    line-height: 1.5 !important;
    overflow-x: auto !important;
  }

  :global(.dark) .tiptap .ProseMirror pre,
  :global(.dark) .tiptap pre {
    background-color: rgb(3 7 18) !important;
    color: rgb(243 244 246) !important;
    border-color: rgb(55 65 81) !important;
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.35) !important;
  }
  .ProseMirror pre code,
  pre code {
    background-color: transparent !important;
    padding: 0 !important;
    color: inherit !important;
    border-radius: 0 !important;
  }

  /* Syntax highlighting (lowlight/hljs classes) */
  .ProseMirror pre .hljs-comment,
  pre .hljs-comment,
  .ProseMirror pre .hljs-quote,
  pre .hljs-quote {
    @apply text-gray-500 italic;
  }

  .ProseMirror pre .hljs-keyword,
  pre .hljs-keyword,
  .ProseMirror pre .hljs-selector-tag,
  pre .hljs-selector-tag,
  .ProseMirror pre .hljs-addition,
  pre .hljs-addition {
    @apply text-purple-400;
  }

  .ProseMirror pre .hljs-number,
  pre .hljs-number,
  .ProseMirror pre .hljs-string,
  pre .hljs-string,
  .ProseMirror pre .hljs-meta .hljs-meta-string,
  pre .hljs-meta .hljs-meta-string,
  .ProseMirror pre .hljs-literal,
  pre .hljs-literal,
  .ProseMirror pre .hljs-doctag,
  pre .hljs-doctag,
  .ProseMirror pre .hljs-regexp,
  pre .hljs-regexp {
    @apply text-green-400;
  }

  .ProseMirror pre .hljs-attribute,
  pre .hljs-attribute,
  .ProseMirror pre .hljs-attr,
  pre .hljs-attr,
  .ProseMirror pre .hljs-variable,
  pre .hljs-variable,
  .ProseMirror pre .hljs-template-variable,
  pre .hljs-template-variable,
  .ProseMirror pre .hljs-class .hljs-title,
  pre .hljs-class .hljs-title,
  .ProseMirror pre .hljs-type,
  pre .hljs-type {
    @apply text-yellow-300;
  }

  .ProseMirror pre .hljs-symbol,
  pre .hljs-symbol,
  .ProseMirror pre .hljs-bullet,
  pre .hljs-bullet,
  .ProseMirror pre .hljs-subst,
  pre .hljs-subst,
  .ProseMirror pre .hljs-meta,
  pre .hljs-meta,
  .ProseMirror pre .hljs-link,
  pre .hljs-link {
    @apply text-blue-400;
  }

  .ProseMirror pre .hljs-built_in,
  pre .hljs-built_in,
  .ProseMirror pre .hljs-deletion,
  pre .hljs-deletion {
    @apply text-red-400;
  }

  .ProseMirror pre .hljs-formula,
  pre .hljs-formula {
    @apply bg-gray-800 italic;
  }

  .ProseMirror pre .hljs-emphasis,
  pre .hljs-emphasis {
    @apply italic;
  }

  .ProseMirror pre .hljs-strong,
  pre .hljs-strong {
    @apply font-bold;
  }

  ul {
    @apply list-disc ml-5 my-4;

    ul {
      @apply list-[circle] my-1;
    }

    ul ul {
      @apply list-[square];
    }
  }

  ol {
    @apply list-decimal ml-5 my-4;

    ol {
      @apply list-[lower-alpha] my-1;
    }

    ol ol {
      @apply list-[lower-roman];
    }
  }

  li {
    @apply mb-1;

    > ul,
    > ol {
      @apply mt-1;
    }
  }

  blockquote {
    @apply border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-4 text-gray-600 dark:text-gray-400;

    blockquote {
      @apply mt-2;
    }
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
