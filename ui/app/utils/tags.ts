export type { NormalizeTagsOptions, TagsInput } from '@gran/shared/utils/tags';

export { formatTagsCsv, normalizeTags, parseTags } from '@gran/shared/utils/tags';

/**
 * Coerces various forms of tag input (string, array, null) into a normalized string array.
 * 
 * @param value The value to coerce.
 * @returns A string array of tags.
 */
export function coerceTagsToArray(value: string[] | string | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return parseTags(value);
  return [];
}
