export function normalizeLocale(
  input: string | null | undefined,
  options: { defaultLocale?: string } = {},
): string {
  const fallback = options.defaultLocale ?? 'en-US';
  if (!input) return fallback;

  const raw = String(input).trim();
  if (!raw) return fallback;

  const normalized = raw.replace(/_/g, '-');
  const [languageRaw, regionRaw] = normalized.split('-');

  const language = String(languageRaw || '')
    .trim()
    .toLowerCase();
  const region = String(regionRaw || '').trim();

  if (!language) return fallback;

  const defaults: Record<string, string> = {
    en: 'en-US',
    ru: 'ru-RU',
  };

  if (!region) {
    return defaults[language] ?? fallback;
  }

  return `${language}-${region.toUpperCase()}`;
}
