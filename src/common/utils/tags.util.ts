export interface NormalizeTagsOptions {
  lowercase?: boolean;
  dedupe?: boolean;
  dedupeCaseInsensitive?: boolean;
  limit?: number;
}

export type TagsInput = string | string[] | null | undefined;

export { formatTagsCsv, normalizeTags, parseTags } from '@gran/shared/utils/tags';
