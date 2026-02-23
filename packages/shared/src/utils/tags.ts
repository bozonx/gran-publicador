export interface NormalizeTagsOptions {
  lowercase?: boolean;
  dedupe?: boolean;
  dedupeCaseInsensitive?: boolean;
  limit?: number;
}

export type TagsInput = string | string[] | null | undefined;

function normalizeTagValue(value: unknown): string {
  const s = String(value ?? '')
    .replace(/^#+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

export function parseTags(raw: TagsInput): string[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map(normalizeTagValue).filter(Boolean);
  }

  return String(raw).split(',').map(normalizeTagValue).filter(Boolean);
}

export function normalizeTags(tags: string[], options: NormalizeTagsOptions = {}): string[] {
  const { lowercase = false, dedupe = true, dedupeCaseInsensitive = true, limit } = options;

  let out = (tags ?? []).map(normalizeTagValue).filter(Boolean);

  if (lowercase) {
    out = out.map(t => t.toLowerCase());
  }

  if (dedupe) {
    const seen = new Set<string>();
    const deduped: string[] = [];

    for (const t of out) {
      const key = dedupeCaseInsensitive ? t.toLowerCase() : t;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(t);
    }

    out = deduped;
  }

  if (typeof limit === 'number') {
    out = out.slice(0, Math.max(0, limit));
  }

  return out;
}

export function formatTagsCsv(tags: string[] | null | undefined): string {
  return (tags ?? []).join(', ');
}
