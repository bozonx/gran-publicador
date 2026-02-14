import { normalizeTags, parseTags } from '~/utils/tags';

export interface MergePublicationTagSuggestionsInput {
  selectedTags: string[];
  localTags: string[];
  remoteTags: string[];
  searchTerm: string;
}

export function mergePublicationTagSuggestions(
  input: MergePublicationTagSuggestionsInput,
): string[] {
  const merged = normalizeTags(
    [...input.selectedTags, ...input.localTags, ...input.remoteTags],
    {
      dedupeCaseInsensitive: true,
    },
  );

  const query = input.searchTerm.trim().toLowerCase();
  if (!query) {
    return merged;
  }

  return merged.filter(tag => tag.toLowerCase().includes(query));
}

export interface AppendPublicationTagsFromInputResult {
  nextTags: string[];
  hasAddedTags: boolean;
}

export function appendPublicationTagsFromInput(
  currentTags: string[],
  rawInput: string,
  limit = 50,
): AppendPublicationTagsFromInputResult {
  const parsedTags = normalizeTags(parseTags(rawInput), {
    limit,
  });

  if (parsedTags.length === 0) {
    return {
      nextTags: currentTags,
      hasAddedTags: false,
    };
  }

  const nextTags = normalizeTags([...currentTags, ...parsedTags], {
    limit,
  });

  return {
    nextTags,
    hasAddedTags: nextTags.length !== currentTags.length,
  };
}
