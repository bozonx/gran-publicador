import { ref, type ShallowRef } from 'vue';
import type { Editor } from '@tiptap/core';

export interface TextSelectionRange {
  from: number;
  to: number;
}

const LIST_NODE_TYPES = new Set(['bulletList', 'orderedList']);

/**
 * Expand selection range so that every touched block is fully included.
 * For lists: expands to cover complete listItems that overlap with the selection,
 * NOT the entire list (so unselected items are excluded).
 * For other blocks: expands to the nearest top-level block boundary.
 */
function expandRangeToBlocks(editor: Editor, range: TextSelectionRange): TextSelectionRange {
  const doc = editor.state.doc;
  const docSize = doc.content.size;
  let from = Math.max(0, Math.min(range.from, docSize));
  let to = Math.max(0, Math.min(range.to, docSize));
  if (from >= to) return { from, to };

  const $from = doc.resolve(from);
  const $to = doc.resolve(Math.max(from, to - 1));

  // Walk up from $from to find the best expansion depth
  // For list items: expand to listItem boundary (not the whole list)
  // For everything else: expand to depth 1 (top-level block)
  const fromDepth = findExpansionDepth($from);
  const toDepth = findExpansionDepth($to);

  from = $from.before(fromDepth);
  to = $to.after(toDepth);

  return {
    from: Math.max(0, from),
    to: Math.min(docSize, to),
  };
}

/**
 * Find the depth to expand to for a resolved position.
 * If inside a listItem, returns the listItem depth.
 * Otherwise returns depth 1 (top-level block).
 */
function findExpansionDepth(pos: any): number {
  for (let d = pos.depth; d >= 1; d -= 1) {
    if (pos.node(d).type.name === 'listItem') return d;
  }
  return Math.min(1, pos.depth);
}

/**
 * Get the markdown manager from the editor's storage.
 * Returns null if the Markdown extension is not installed.
 */
function getMarkdownManager(editor: Editor): any {
  return (editor as any).storage?.markdown?.manager ?? null;
}

/**
 * Extract markdown from a range of the editor document.
 * Uses the editor's own markdown manager to serialize JSON nodes.
 *
 * For lists: only includes listItems that overlap with the range,
 * wrapping them in the parent list type to preserve structure.
 * For other blocks: includes the full top-level node.
 */
export function getSelectionMarkdown(editor: Editor, range?: TextSelectionRange): string {
  const { state } = editor;

  const effectiveRange: TextSelectionRange | null = (() => {
    if (range) return range;
    const selection = state.selection;
    if (selection.empty) return null;
    return { from: selection.from, to: selection.to };
  })();

  if (!effectiveRange) return '';

  const nodes: any[] = [];

  // Walk through top-level children of doc
  state.doc.forEach((node: any, offset: number) => {
    const nodeStart = offset;
    const nodeEnd = offset + node.nodeSize;

    // Skip nodes that don't overlap with the range
    if (nodeEnd <= effectiveRange.from || nodeStart >= effectiveRange.to) return;

    if (LIST_NODE_TYPES.has(node.type.name)) {
      // For lists: collect only listItems that overlap with the range
      const items: any[] = [];
      node.forEach((child: any, childOffset: number) => {
        const itemStart = nodeStart + 1 + childOffset;
        const itemEnd = itemStart + child.nodeSize;
        if (itemEnd > effectiveRange.from && itemStart < effectiveRange.to) {
          items.push(child.toJSON());
        }
      });
      if (items.length > 0) {
        nodes.push({
          type: node.type.name,
          attrs: node.attrs,
          content: items,
        });
      }
    } else {
      nodes.push(node.toJSON());
    }
  });

  if (nodes.length === 0) return '';

  const manager = getMarkdownManager(editor);
  if (!manager) return '';

  const docJson = { type: 'doc', content: nodes };
  const markdown = String(manager.serialize(docJson)).replace(/\u00a0/g, ' ');
  return markdown;
}

/**
 * Replace a selection range with markdown content.
 * Parses markdown via the editor's markdown manager into JSON,
 * then replaces the target range.
 */
export function replaceSelectionWithMarkdown(
  editor: Editor,
  range: TextSelectionRange,
  markdown: string,
): void {
  const manager = getMarkdownManager(editor);
  if (!manager) return;

  // Parse markdown into Tiptap JSON via the manager
  const docJson = manager.parse(markdown);
  if (!docJson?.content?.length) return;

  const { from, to } = range;
  const docSize = editor.state.doc.content.size;

  // Validate positions against current document
  if (from < 0 || to > docSize || from > to) return;

  editor
    .chain()
    .focus()
    .setTextSelection({ from, to })
    .deleteSelection()
    .insertContent(docJson.content)
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

    pendingRange.value = expandRangeToBlocks(editor, {
      from: selection.from,
      to: selection.to,
    });

    try {
      pendingSourceText.value = getSelectionMarkdown(editor, pendingRange.value!);
      if (!pendingSourceText.value) {
        pendingRange.value = null;
        return '';
      }

      isActionPending.value = true;

      // Lock editor to prevent edits that would invalidate positions
      editor.setEditable(false);

      return pendingSourceText.value;
    } catch {
      pendingRange.value = null;
      pendingSourceText.value = '';
      isActionPending.value = false;
      return '';
    }
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
