import type { LanguageOption } from '~/types/languages'

export const LANGUAGE_OPTIONS: LanguageOption[] = [
    { value: 'ru-RU', label: 'Russian', icon: 'i-heroicons-language' },
    { value: 'en-US', label: 'English (US)', icon: 'i-heroicons-language' },
    { value: 'en-GB', label: 'English (UK)', icon: 'i-heroicons-language' },
    { value: 'zh-CN', label: 'Chinese (Simplified)', icon: 'i-heroicons-language' },
    { value: 'zh-TW', label: 'Chinese (Traditional)', icon: 'i-heroicons-language' },
    { value: 'es-ES', label: 'Spanish', icon: 'i-heroicons-language' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)', icon: 'i-heroicons-language' },
    { value: 'pt-PT', label: 'Portuguese (Portugal)', icon: 'i-heroicons-language' },
    { value: 'fr-FR', label: 'French', icon: 'i-heroicons-language' },
    { value: 'de-DE', label: 'German', icon: 'i-heroicons-language' },
    { value: 'ja-JP', label: 'Japanese', icon: 'i-heroicons-language' },
    { value: 'ko-KR', label: 'Korean', icon: 'i-heroicons-language' },
    { value: 'it-IT', label: 'Italian', icon: 'i-heroicons-language' },
    { value: 'tr-TR', label: 'Turkish', icon: 'i-heroicons-language' },
    { value: 'vi-VN', label: 'Vietnamese', icon: 'i-heroicons-language' },
    { value: 'pl-PL', label: 'Polish', icon: 'i-heroicons-language' },
    { value: 'uk-UA', label: 'Ukrainian', icon: 'i-heroicons-language' },
    { value: 'ar-SA', label: 'Arabic', icon: 'i-heroicons-language' },
    { value: 'hi-IN', label: 'Hindi', icon: 'i-heroicons-language' },
    { value: 'id-ID', label: 'Indonesian', icon: 'i-heroicons-language' },
    { value: 'th-TH', label: 'Thai', icon: 'i-heroicons-language' },
    { value: 'uz-UZ', label: 'Uzbek', icon: 'i-heroicons-language' },
]

export function getLanguageLabel(code: string): string {
    return LANGUAGE_OPTIONS.find(l => l.value === code)?.label || code
}
