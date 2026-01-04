import type { LanguageOption } from '~/types/languages'

export const LANGUAGE_OPTIONS: LanguageOption[] = [
    { value: 'ru-RU', label: 'Русский (Russian)', icon: 'i-heroicons-language' },
    { value: 'en-US', label: 'English (United States)', icon: 'i-heroicons-language' },
    { value: 'en-GB', label: 'English (United Kingdom)', icon: 'i-heroicons-language' },
    { value: 'zh-CN', label: '简体中文 (Chinese Simplified)', icon: 'i-heroicons-language' },
    { value: 'zh-TW', label: '繁體中文 (Chinese Traditional)', icon: 'i-heroicons-language' },
    { value: 'es-ES', label: 'Español (Spanish)', icon: 'i-heroicons-language' },
    { value: 'pt-BR', label: 'Português (Portuguese Brazil)', icon: 'i-heroicons-language' },
    { value: 'pt-PT', label: 'Português (Portuguese Portugal)', icon: 'i-heroicons-language' },
    { value: 'fr-FR', label: 'Français (French)', icon: 'i-heroicons-language' },
    { value: 'de-DE', label: 'Deutsch (German)', icon: 'i-heroicons-language' },
    { value: 'ja-JP', label: '日本語 (Japanese)', icon: 'i-heroicons-language' },
    { value: 'ko-KR', label: '한국어 (Korean)', icon: 'i-heroicons-language' },
    { value: 'it-IT', label: 'Italiano (Italian)', icon: 'i-heroicons-language' },
    { value: 'tr-TR', label: 'Türkçe (Turkish)', icon: 'i-heroicons-language' },
    { value: 'vi-VN', label: 'Tiếng Việt (Vietnamese)', icon: 'i-heroicons-language' },
    { value: 'pl-PL', label: 'Polski (Polish)', icon: 'i-heroicons-language' },
    { value: 'uk-UA', label: 'Українська (Ukrainian)', icon: 'i-heroicons-language' },
    { value: 'ar-SA', label: 'العربية (Arabic)', icon: 'i-heroicons-language' },
    { value: 'hi-IN', label: 'हिन्दी (Hindi)', icon: 'i-heroicons-language' },
    { value: 'id-ID', label: 'Bahasa Indonesia (Indonesian)', icon: 'i-heroicons-language' },
    { value: 'th-TH', label: 'ไทย (Thai)', icon: 'i-heroicons-language' },
    { value: 'uz-UZ', label: 'Oʻzbekча (Uzbek)', icon: 'i-heroicons-language' },
]

export function getLanguageLabel(code: string): string {
    return LANGUAGE_OPTIONS.find(l => l.value === code)?.label || code
}
