import { describe, expect, it } from 'vitest';

import {
  appendPublicationTagsFromInput,
  mergePublicationTagSuggestions,
} from '../../app/utils/publication-tags-filter';

describe('utils/publication-tags-filter', () => {
  describe('mergePublicationTagSuggestions', () => {
    it('merges selected, local and remote tags without case-insensitive duplicates', () => {
      const result = mergePublicationTagSuggestions({
        selectedTags: ['Tag'],
        localTags: ['tag2', 'News'],
        remoteTags: ['TAG', 'Release'],
        searchTerm: '',
      });

      expect(result).toEqual(['Tag', 'tag2', 'News', 'Release']);
    });

    it('filters merged tags by search term', () => {
      const result = mergePublicationTagSuggestions({
        selectedTags: ['Tag'],
        localTags: ['tag2', 'News'],
        remoteTags: ['Release'],
        searchTerm: 'ta',
      });

      expect(result).toEqual(['Tag', 'tag2']);
    });
  });

  describe('appendPublicationTagsFromInput', () => {
    it('appends parsed tags from comma-separated input', () => {
      const result = appendPublicationTagsFromInput(['tag'], 'tag2, tag3');

      expect(result).toEqual({
        nextTags: ['tag', 'tag2', 'tag3'],
        hasAddedTags: true,
      });
    });

    it('does not add duplicate tags in case-insensitive mode', () => {
      const result = appendPublicationTagsFromInput(['Tag'], 'tag');

      expect(result).toEqual({
        nextTags: ['Tag'],
        hasAddedTags: false,
      });
    });
  });
});
