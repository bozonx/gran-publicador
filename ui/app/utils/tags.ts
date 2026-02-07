export interface NormalizeTagsOptions {
  lowercase?: boolean;
  dedupe?: boolean;
  limit?: number;
}

export function parseTags(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map(t => String(t ?? '').trim()).filter(Boolean);
  }

  return String(raw)
    .split(/[\s,]+/)
    .map(t => t.trim())
    .filter(Boolean);
}

export function normalizeTags(tags: string[], options: NormalizeTagsOptions = {}): string[] {
  const { lowercase = false, dedupe = true, limit } = options;

  let out = (tags ?? []).map(t => String(t ?? '').trim()).filter(Boolean);
  if (lowercase) {
    out = out.map(t => t.toLowerCase());
  }

  if (dedupe) {
    out = Array.from(new Set(out));
  }

  if (typeof limit === 'number') {
    out = out.slice(0, Math.max(0, limit));
  }

  return out;
}

export function formatTagsCsv(tags: string[] | null | undefined): string {
  return (tags ?? []).join(', ');
}
