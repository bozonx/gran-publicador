import { sanitizeContentPreserveMarkdown, stripHtmlAndSpecialChars } from '~/utils/text';
import { normalizeTags } from '~/utils/tags';

const PUBLICATION_SEPARATOR = '\n\n---\n\n';

export interface ContentLibraryValidationLimits {
  MAX_REORDER_MEDIA: number;
  MAX_PUBLICATION_CONTENT_LENGTH: number;
  MAX_NOTE_LENGTH: number;
  MAX_TAGS_LENGTH: number;
  MAX_TAGS_COUNT: number;
  MAX_TITLE_LENGTH: number;
}

function isItemEmptyForPublication(item: any): boolean {
  const hasAnyText = (item.blocks || []).some(
    (b: any) => stripHtmlAndSpecialChars(b.text || '').trim().length > 0,
  );
  const hasAnyMedia = (item.blocks || []).some((b: any) =>
    (b.media || []).some((m: any) => !!m.mediaId),
  );
  const hasAnyNote = stripHtmlAndSpecialChars(item.note || '').trim().length > 0;
  const hasAnyTitle = (item.title || '').toString().trim().length > 0;

  return !(hasAnyText || hasAnyMedia || hasAnyNote || hasAnyTitle);
}

function normalizePublicationTags(rawTags: string[], maxCount: number): string[] {
  return normalizeTags(rawTags, {
    lowercase: true,
    dedupe: true,
    limit: maxCount,
  });
}

export function aggregateSelectedItemsToPublicationOrThrow(
  selectedItems: any[],
  limits: ContentLibraryValidationLimits,
): {
  title: string;
  content: string;
  note: string;
  tags: string[];
  media: Array<{ id: string; hasSpoiler?: boolean }>;
  projectId?: string;
  allowProjectSelection: boolean;
  contentItemIds: string[];
} {
  const itemsToUse = (selectedItems || []).filter(item => !isItemEmptyForPublication(item));
  if (itemsToUse.length === 0) {
    throw new Error('EMPTY_SELECTION');
  }

  const titleParts: string[] = [];
  const contentParts: string[] = [];
  const noteParts: string[] = [];
  const allTags: string[] = [];

  // mediaId -> chosen media input (chosen from the latest block.order)
  const mediaPick = new Map<
    string,
    { input: { id: string; hasSpoiler?: boolean }; blockOrder: number }
  >();

  const projectIds = new Set<string>();

  for (const item of itemsToUse) {
    if (item.projectId) projectIds.add(item.projectId);

    const title = (item.title || '').toString().trim();
    if (title) titleParts.push(title);

    const note = (item.note || '').toString().trim();
    if (note) noteParts.push(note);

    for (const tag of item.tags || []) {
      if (typeof tag === 'string') allTags.push(tag);
    }

    const sortedBlocks = (item.blocks || [])
      .slice()
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    for (const block of sortedBlocks) {
      const blockText = sanitizeContentPreserveMarkdown(block.text || '').trim();
      if (blockText) contentParts.push(blockText);

      const blockOrder = Number(block.order ?? 0);
      const sortedMedia = (block.media || [])
        .slice()
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      for (const link of sortedMedia) {
        const mediaId = link?.mediaId;
        if (!mediaId) continue;

        const candidate = { id: mediaId, hasSpoiler: link.hasSpoiler ? true : undefined };
        const prev = mediaPick.get(mediaId);
        if (!prev || blockOrder >= prev.blockOrder) {
          mediaPick.set(mediaId, { input: candidate, blockOrder });
        }
      }
    }
  }

  const title = titleParts.join(' | ');
  const content = contentParts.join(PUBLICATION_SEPARATOR);
  const note = Array.from(new Set(noteParts)).join(PUBLICATION_SEPARATOR);

  const tags = normalizePublicationTags(allTags, limits.MAX_TAGS_COUNT);

  const media = Array.from(mediaPick.values())
    .sort((a, b) => a.blockOrder - b.blockOrder)
    .map(x => x.input);

  if (title.length > limits.MAX_TITLE_LENGTH) {
    throw new Error('LIMIT_TITLE');
  }
  if (content.length > limits.MAX_PUBLICATION_CONTENT_LENGTH) {
    throw new Error('LIMIT_CONTENT');
  }
  if (note.length > limits.MAX_NOTE_LENGTH) {
    throw new Error('LIMIT_NOTE');
  }
  // tags length validation is handled by MAX_TAGS_COUNT and per-tag limits on backend
  if (media.length > limits.MAX_REORDER_MEDIA) {
    throw new Error('LIMIT_MEDIA');
  }

  return {
    title,
    content,
    note,
    tags,
    media,
    projectId: projectIds.size === 1 ? Array.from(projectIds)[0] : undefined,
    allowProjectSelection: projectIds.size !== 1,
    contentItemIds: itemsToUse.map(i => i.id),
  };
}
