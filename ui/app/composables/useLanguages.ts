import { LANGUAGE_OPTIONS, getLanguageLabel } from '~/utils/languages'
import type { LanguageOption } from '~/types/languages'

export function useLanguages() {
    return {
        languageOptions: LANGUAGE_OPTIONS,
        getLanguageLabel
    }
}
