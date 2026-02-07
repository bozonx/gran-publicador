import { ref, type ShallowRef } from 'vue';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Markdown } from '@tiptap/markdown';
import { common, createLowlight } from 'lowlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

const lowlight = createLowlight(common);

export interface TextSelectionRange {
  from: number;
  to: number;
}

/**
 * Shared extensions for serialization (excludes Placeholder and CharacterCount
 * to avoid i18n "localsInner" errors in temporary editors).
 */
function buildSerializationExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
    }),
    Markdown.configure({
      transformPastedText: true,
      transformCopiedText: true,
      markedOptions: {
        gfm: true,
        breaks: false,
      },
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'javascript',
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ];
}

/**
 * Extract markdown from the current selection of a Tiptap editor.
 * Creates a temporary editor for serialization, then destroys it.
 */
export function getSelectionMarkdown(editor: Editor): string {
  const { state } = editor;
  const selection = state.selection;
  if (selection.empty) return '';

  const slice = selection.content();
  const fragment = slice.content;
  const schema = state.schema;

  const hasOnlyInline = (() => {
    if (fragment.childCount === 0) return true;
    for (let i = 0; i < fragment.childCount; i += 1) {
      if (!fragment.child(i).isInline) return false;
    }
    return true;
  })();

  const docType = schema.nodes.doc;
  const paragraphType = schema.nodes.paragraph;
  if (!docType || !paragraphType) return '';

  const doc = hasOnlyInline
    ? docType.create(null, [paragraphType.create(null, fragment)])
    : docType.create(null, fragment);

  const tempEditor = new Editor({
    content: doc.toJSON(),
    extensions: buildSerializationExtensions(),
  });

  const markdown = tempEditor.storage.markdown.getMarkdown();
  tempEditor.destroy();
  return markdown;
}

/**
 * Replace a selection range with markdown content.
 * Parses markdown into ProseMirror nodes via a temporary editor,
 * then replaces the target range using a single transaction.
 */
export function replaceSelectionWithMarkdown(
  editor: Editor,
  range: TextSelectionRange,
  markdown: string,
): void {
  // Parse markdown into ProseMirror document via temporary editor
  const tempEditor = new Editor({
    content: markdown,
    contentType: 'markdown',
    extensions: buildSerializationExtensions(),
  });

  const parsedDoc = tempEditor.state.doc;
  tempEditor.destroy();

  // Extract content nodes from the parsed document
  const nodes: any[] = [];
  parsedDoc.forEach((node: any) => nodes.push(node));

  const { from, to } = range;
  const docSize = editor.state.doc.content.size;

  // Validate positions against current document
  if (from < 0 || to > docSize || from > to) return;

  editor
    .chain()
    .focus()
    .setTextSelection({ from, to })
    .deleteSelection()
    .insertContent(nodes.map(n => n.toJSON()))
    .run();
}

/**
 * Composable for managing text selection actions in a Tiptap editor.
 * Provides capture/apply pattern for async operations (translate, LLM, etc.)
 * that need to remember the selection while a modal/request is in progress.
 *
 * While a pending action is active, the editor is set to non-editable
 * to prevent position invalidation.
 */
export function useEditorTextActions(editorRef: ShallowRef<Editor | undefined>) {
  const pendingRange = ref<TextSelectionRange | null>(null);
  const pendingSourceText = ref('');
  const isActionPending = ref(false);

  /**
   * Capture the current selection: extract markdown, lock editor, store range.
   * Returns the markdown text of the selection, or empty string if nothing selected.
   */
  function captureSelection(): string {
    const editor = editorRef.value;
    if (!editor) return '';

    const selection = editor.state.selection;
    if (selection.empty) return '';

    pendingRange.value = {
      from: selection.from,
      to: selection.to,
    };

    pendingSourceText.value = getSelectionMarkdown(editor);
    isActionPending.value = true;

    // Lock editor to prevent edits that would invalidate positions
    editor.setEditable(false);

    return pendingSourceText.value;
  }

  /**
   * Apply markdown result to the previously captured selection range.
   * Unlocks the editor afterwards.
   */
  function applyResult(markdown: string): boolean {
    const editor = editorRef.value;
    if (!editor || !pendingRange.value) {
      cancelAction();
      return false;
    }

    if (!markdown.trim()) {
      cancelAction();
      return false;
    }

    // Unlock editor before applying changes
    editor.setEditable(true);

    replaceSelectionWithMarkdown(editor, pendingRange.value, markdown);

    pendingRange.value = null;
    pendingSourceText.value = '';
    isActionPending.value = false;
    return true;
  }

  /**
   * Cancel the pending action and unlock the editor.
   */
  function cancelAction(): void {
    const editor = editorRef.value;
    if (editor && isActionPending.value) {
      editor.setEditable(true);
    }

    pendingRange.value = null;
    pendingSourceText.value = '';
    isActionPending.value = false;
  }

  return {
    pendingRange,
    pendingSourceText,
    isActionPending,
    captureSelection,
    applyResult,
    cancelAction,
  };
}
