export function normalizeLocale(
  input: string | null | undefined,
  options: { defaultLocale?: string; allowedLocales?: string[] } = {},
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

  const parsedLocale = region ? `${language}-${region.toUpperCase()}` : (defaults[language] ?? language);

  if (options.allowedLocales?.length) {
    if (options.allowedLocales.includes(parsedLocale)) {
      return parsedLocale;
    }
    const match = options.allowedLocales.find((l) => l.toLowerCase().startsWith(language + '-'));
    if (match) return match;
    return fallback;
  }

  return parsedLocale;
}

export function getLanguageName(locale: string): string {
  const prefix = locale.split('-')[0]?.toLowerCase();
  const map: Record<string, string> = {
    en: 'English',
    ru: 'Russian',
  };
  return map[prefix] || locale;
}
