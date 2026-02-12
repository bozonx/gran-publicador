import { ref, type ShallowRef } from 'vue';
import type { Editor } from '@tiptap/core';

export interface TextSelectionRange {
  from: number;
  to: number;
}

function replaceSelectionWithInlineMarkdown(
  editor: Editor,
  range: TextSelectionRange,
  markdown: string,
): void {
  const manager = getMarkdownManager(editor);
  if (!manager) return;

  const docJson = manager.parse(markdown);
  if (!docJson?.content?.length) return;

  // Prefer inline content of the first paragraph when possible.
  let contentToInsert: any[] = docJson.content;

  if (docJson.content.length === 1 && docJson.content[0]?.type === 'paragraph') {
    contentToInsert = Array.isArray(docJson.content[0]?.content) ? docJson.content[0].content : [];
  }

  if (contentToInsert.length === 0) return;

  editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, contentToInsert).run();
}

const LIST_NODE_TYPES = new Set(['bulletList', 'orderedList']);

function isMeaningfulText(text: string): boolean {
  return text.replace(/\u00a0/g, ' ').trim().length > 0;
}

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

function getSelectionKind(editor: Editor): 'inline' | 'block' {
  const { selection } = editor.state;
  if (selection.empty) return 'inline';

  const $from = selection.$from;
  const $to = selection.$to;

  const sameParent = $from.sameParent($to);
  const inTextblock = $from.parent.isTextblock && $to.parent.isTextblock;

  if (sameParent && inTextblock) {
    return 'inline';
  }

  return 'block';
}

/**
 * Get the markdown manager from the editor's storage.
 * Returns null if the Markdown extension is not installed.
 */
function getMarkdownManager(editor: Editor): any {
  return (editor as any).storage?.markdown?.manager ?? null;
}

function fragmentToJsonArray(fragment: any): any[] {
  const out: any[] = [];
  if (!fragment) return out;
  fragment.forEach((node: any) => {
    out.push(node.toJSON());
  });
  return out;
}

function getSelectedInlineMarkdown(editor: Editor, range: TextSelectionRange): string {
  const manager = getMarkdownManager(editor);
  if (!manager) return '';

  const slice = editor.state.doc.slice(range.from, range.to);
  const inlineContent = fragmentToJsonArray(slice.content);
  if (inlineContent.length === 0) return '';

  // Wrap inline selection into a paragraph to keep marks serialization stable.
  const docJson = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: inlineContent,
      },
    ],
  };

  // Markdown serializer usually adds a trailing newline for paragraphs.
  return String(manager.serialize(docJson))
    .replace(/\u00a0/g, ' ')
    .trim();
}

function getListContext(
  editor: Editor,
  range: TextSelectionRange,
): {
  listType: 'bulletList' | 'orderedList';
  listPos: number;
} | null {
  const doc = editor.state.doc;
  const docSize = doc.content.size;

  const fromProbe = Math.max(0, Math.min(range.from + 1, docSize));
  const toProbe = Math.max(0, Math.min(range.to - 1, docSize));

  if (fromProbe >= toProbe) return null;

  const $from = doc.resolve(fromProbe);
  const $to = doc.resolve(toProbe);

  function findListDepth($pos: any): number | null {
    for (let d = $pos.depth; d >= 1; d -= 1) {
      if ($pos.node(d).type.name === 'listItem') {
        const listDepth = d - 1;
        const listNode = $pos.node(listDepth);
        if (LIST_NODE_TYPES.has(listNode.type.name)) return listDepth;
      }
    }
    return null;
  }

  const fromListDepth = findListDepth($from);
  const toListDepth = findListDepth($to);
  if (fromListDepth === null || toListDepth === null) return null;

  const fromListPos = $from.before(fromListDepth);
  const toListPos = $to.before(toListDepth);
  if (fromListPos !== toListPos) return null;

  const listNode = $from.node(fromListDepth);
  if (!LIST_NODE_TYPES.has(listNode.type.name)) return null;

  return {
    listType: listNode.type.name as 'bulletList' | 'orderedList',
    listPos: fromListPos,
  };
}

function filterEmptyListItemsJson(content: any[]): any[] {
  return content.filter(node => {
    if (node?.type !== 'listItem') return true;
    const text = String(node?.textContent ?? '');
    if (text) return isMeaningfulText(text);

    // Fallback: try to walk content and find any non-empty text node
    const stack: any[] = Array.isArray(node?.content) ? [...node.content] : [];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (!cur) continue;
      if (cur.type === 'text' && isMeaningfulText(String(cur.text ?? ''))) return true;
      if (Array.isArray(cur.content)) stack.push(...cur.content);
    }
    return false;
  });
}

function getSelectedBlocksMarkdown(editor: Editor, range: TextSelectionRange): string {
  const manager = getMarkdownManager(editor);
  if (!manager) return '';

  const { doc } = editor.state;
  const selected: any[] = [];

  doc.nodesBetween(range.from, range.to, (node: any, pos: number, parent: any) => {
    if (!parent) return true;

    if (parent.type?.name === 'doc') {
      if (LIST_NODE_TYPES.has(node.type.name)) {
        const listItems: any[] = [];
        node.nodesBetween(0, node.content.size, (child: any, childPos: number) => {
          if (child.type.name !== 'listItem') return true;

          const absFrom = pos + 1 + childPos;
          const absTo = absFrom + child.nodeSize;

          if (absTo > range.from && absFrom < range.to) {
            const text = String(child.textContent ?? '');
            if (isMeaningfulText(text)) {
              listItems.push(child.toJSON());
            }
          }

          return false;
        });

        if (listItems.length > 0) {
          selected.push({
            type: node.type.name,
            attrs: node.attrs,
            content: listItems,
          });
        }

        return false;
      }

      selected.push(node.toJSON());
      return false;
    }

    return true;
  });

  if (selected.length === 0) return '';
  return String(manager.serialize({ type: 'doc', content: selected })).replace(/\u00a0/g, ' ');
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
  const { selection } = editor.state;
  if (selection.empty && !range) return '';

  const effectiveRange: TextSelectionRange = range ?? { from: selection.from, to: selection.to };
  const kind = getSelectionKind(editor);

  if (kind === 'inline') {
    return getSelectedInlineMarkdown(editor, effectiveRange);
  }

  return getSelectedBlocksMarkdown(editor, effectiveRange);
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

  const docJson = manager.parse(markdown);
  if (!docJson?.content?.length) return;

  const listContext = getListContext(editor, range);

  let contentToInsert: any[] = docJson.content;

  if (
    listContext &&
    contentToInsert.length === 1 &&
    contentToInsert[0]?.type === listContext.listType &&
    Array.isArray(contentToInsert[0]?.content)
  ) {
    // If selection is inside a list and parsed markdown is a list,
    // insert list items directly to avoid nesting a list inside a listItem.
    contentToInsert = filterEmptyListItemsJson(contentToInsert[0].content);
  }

  const { from, to } = range;
  const docSize = editor.state.doc.content.size;

  // Validate positions against current document
  if (from < 0 || to > docSize || from > to) return;

  editor.chain().focus().insertContentAt({ from, to }, contentToInsert).run();
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
  const pendingKind = ref<'inline' | 'block' | null>(null);
  const isWholeDocument = ref(false);

  /**
   * Capture the current selection: extract markdown, lock editor, store range.
   * Returns the markdown text of the selection, or empty string if nothing selected.
   * If nothing is selected, captures the entire document content.
   */
  function captureSelection(): string {
    const editor = editorRef.value;
    if (!editor) return '';

    const selection = editor.state.selection;
    const isEmpty = selection.empty;

    // If nothing selected, capture entire document
    if (isEmpty) {
      const fullText = editor.getMarkdown();
      if (!fullText.trim()) return '';

      pendingKind.value = 'block';
      isWholeDocument.value = true;
      const docSize = editor.state.doc.content.size;
      pendingRange.value = { from: 0, to: docSize };
      pendingSourceText.value = fullText;
      isActionPending.value = true;
      editor.setEditable(false);

      return fullText;
    }

    const kind = getSelectionKind(editor);
    pendingKind.value = kind;
    isWholeDocument.value = false;

    const rawRange = { from: selection.from, to: selection.to };
    pendingRange.value = kind === 'block' ? expandRangeToBlocks(editor, rawRange) : rawRange;

    try {
      pendingSourceText.value = getSelectionMarkdown(editor, pendingRange.value!);
      if (!pendingSourceText.value) {
        pendingRange.value = null;
        pendingKind.value = null;
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
      pendingKind.value = null;
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

    if (pendingKind.value === 'inline') {
      replaceSelectionWithInlineMarkdown(editor, pendingRange.value, markdown);
    } else {
      replaceSelectionWithMarkdown(editor, pendingRange.value, markdown);
    }

    pendingRange.value = null;
    pendingSourceText.value = '';
    isActionPending.value = false;
    pendingKind.value = null;
    isWholeDocument.value = false;
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
    pendingKind.value = null;
    isWholeDocument.value = false;
  }

  return {
    pendingRange,
    pendingSourceText,
    pendingKind,
    isActionPending,
    isWholeDocument,
    captureSelection,
    applyResult,
    cancelAction,
  };
}
