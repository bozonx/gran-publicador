import { normalizeTags, parseTags } from '~/utils/tags';
import type { PublicationWithRelations } from '~/types/publications';

export function resolvePublicationTags(publication: PublicationWithRelations): string[] {
  const rawTags = (publication as { tags?: unknown }).tags;

  if (Array.isArray(rawTags)) {
    return normalizeTags(rawTags.map(tag => String(tag ?? '')));
  }

  if (typeof rawTags === 'string') {
    return normalizeTags(parseTags(rawTags));
  }

  if (Array.isArray(publication.tagObjects)) {
    return normalizeTags(publication.tagObjects.map(tag => tag.name));
  }

  return [];
}

export function normalizePublication(publication: PublicationWithRelations): PublicationWithRelations {
  return {
    ...publication,
    tags: resolvePublicationTags(publication),
  };
}
