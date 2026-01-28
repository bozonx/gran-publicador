/**
 * Plugin to detect language with specific priority:
 * 1. User profile language (if authorized)
 * 2. Telegram WebApp (if available)
 * 3. Browser language
 * 4. Default (en-US)
 */
export default defineNuxtPlugin((nuxtApp) => {
    const i18n = nuxtApp.$i18n
    if (!i18n) return

    const locale = (i18n as any).locale
    const setLocale = (i18n as any).setLocale
    const locales = (i18n as any).locales // Array of locale objects

    const auth = useAuthStore()

    // Get available locale codes from config
    const availableLocales = computed(() => locales.value.map((l: any) => l.code))

    const DEFAULT_LOCALE = 'en-US'

    /**
     * Normalize and find best match for a language code
     * e.g. 'en-GB' -> 'en-US', 'ru' -> 'ru-RU'
     */
    function findBestMatch(langCode: string | null | undefined): string | null {
        if (!langCode) return null

        // 1. Precise match
        if (availableLocales.value.includes(langCode)) {
            return langCode
        }

        // 2. Fuzzy match by base language (e.g. 'en' from 'en-GB')
        const parts = langCode.split('-')
        const baseLang = parts[0]?.toLowerCase()
        if (!baseLang) return null

        // Find the first available locale that starts with this base lang
        const match = availableLocales.value.find((l: string) => l.toLowerCase().startsWith(baseLang))

        return match || null
    }

    function getTelegramLocale(): string | null {
        if (typeof window === 'undefined') return null
        // @ts-ignore
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user
        return tgUser?.language_code || null
    }

    function getBrowserLocale(): string | null {
        if (typeof navigator === 'undefined') return null
        return navigator.language || (navigator.languages && navigator.languages[0]) || null
    }

    // Logic to run on client init
    if (import.meta.client) {
        // Find initial locale based on priority
        const findTargetLocale = () => {
            // 1. User Profile from DB
            if (auth.user?.language) {
                const match = findBestMatch(auth.user.language)
                if (match) return match
            }

            // 2. Telegram WebApp
            const tgLang = getTelegramLocale()
            if (tgLang) {
                const match = findBestMatch(tgLang)
                if (match) return match
            }

            // 3. Browser
            const browserLang = getBrowserLocale()
            if (browserLang) {
                const match = findBestMatch(browserLang)
                if (match) return match
            }

            // 4. Default / Fallback
            return DEFAULT_LOCALE
        }

        // Apply initial locale
        const initialLocale = findTargetLocale()
        if (initialLocale && initialLocale !== locale.value) {
            console.info(`[i18n] Initializing locale to: ${initialLocale}`)
            if (setLocale) {
                setLocale(initialLocale)
            } else {
                locale.value = initialLocale
            }
        }

        // Watch for user language changes (e.g. after login or manual change in other tab)
        watch(() => auth.user?.language, (newLang) => {
            if (newLang) {
                const match = findBestMatch(newLang)
                if (match && match !== locale.value) {
                    console.info(`[i18n] User language changed, setting locale to: ${match}`)
                    if (setLocale) {
                        setLocale(match)
                    } else {
                        locale.value = match
                    }
                }
            }
        })
    }
})
