<script setup lang="ts">
const { t, locales, setLocale } = useI18n()
const toast = useToast()
const { user, refreshUser } = useAuth()
const api = useApi()

/**
 * Determine effective UI language based on content language and available translations
 */
function getEffectiveUiLanguage(contentLang: string): string {
  const availableCodes = (locales.value as any[]).map(l => l.code)
  
  // 1. Exact match
  if (availableCodes.includes(contentLang)) {
    return contentLang
  }
  
  // 2. Prefix match (e.g. en-GB -> en-US)
  const prefix = contentLang.split('-')[0]
  const samePrefixMatch = availableCodes.find(c => c.startsWith(prefix + '-'))
  if (samePrefixMatch) {
    return samePrefixMatch
  }
  
  // 3. Fallback to default (usually en-US)
  return 'en-US'
}

/**
 * Computed name for the automatic language
 */
const effectiveUiLanguageName = computed(() => {
  const code = getEffectiveUiLanguage(user.value?.language || 'en-US')
  const locale = (locales.value as any[]).find(l => l.code === code)
  return locale?.name || code
})

/**
 * Change content language
 */
async function changeContentLanguage(newLocale: string) {
  if (!newLocale) return
  
  const data: any = { language: newLocale }
  
  // If auto-mode is enabled, also update uiLanguage
  if (user.value?.isUiLanguageAuto) {
    const nextUiLang = getEffectiveUiLanguage(newLocale)
    data.uiLanguage = nextUiLang
    // Apply immediately to the current session
    setLocale(nextUiLang)
  }
  
  await updateProfile(data)
}

/**
 * Toggle automatic interface language mode
 */
async function toggleAutoUiMode(enabled: boolean) {
  console.log('toggleAutoUiMode called with:', enabled)
  const data: any = { isUiLanguageAuto: enabled }
  
  if (enabled && user.value?.language) {
    const nextUiLang = getEffectiveUiLanguage(user.value.language)
    data.uiLanguage = nextUiLang
    setLocale(nextUiLang)
  }
  
  await updateProfile(data)
}

/**
 * Change interface language manually
 */
async function changeUiLanguage(newLocale: string) {
  if (!newLocale) return
  console.log('changeUiLanguage called with:', newLocale)
  
  // When changing manually, we ensure isUiLanguageAuto is false
  const data: any = { 
    uiLanguage: newLocale,
    isUiLanguageAuto: false 
  }
  
  await updateProfile(data)
  setLocale(newLocale)
}

async function updateProfile(data: any) {
  console.log('Updating profile with data:', data)
  try {
    const result = await api.patch('/users/me', data)
    console.log('Update result:', result)
    await refreshUser()
    console.log('User refreshed, new state:', user.value)
    toast.add({
      title: t('common.success'),
      description: t('settings.languageChanged', 'Language settings updated'),
      color: 'success',
      icon: 'i-heroicons-check-circle'
    })
  } catch (err) {
    console.error('Failed to update language setting:', err)
    toast.add({
      title: t('common.error'),
      description: t('settings.syncError', 'Failed to save settings'),
      color: 'error',
    })
  }
}
</script>

<template>
  <UiAppCard :title="t('settings.language')" title-class="text-lg font-medium text-gray-900 dark:text-white">
    <div class="space-y-8">
      <!-- Content Language (Main) -->
      <div>
        <div class="flex items-center gap-1 mb-1">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('settings.contentLanguage', 'Content Language') }}
          </label>
          <UTooltip :text="t('settings.contentLanguageDetails')">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-gray-400" />
          </UTooltip>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {{ t('settings.contentLanguageHelp', 'Preferred language for news, search and publications.') }}
        </p>
        <div class="max-w-xs">
          <CommonLanguageSelect
            :model-value="user?.language"
            mode="all"
            searchable
            @update:model-value="changeContentLanguage"
          />
        </div>
      </div>

      <!-- Interface Language Section -->
      <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
        <div class="flex flex-col gap-4">
          <!-- Auto Logic Toggle -->
          <div class="flex items-start">
            <UCheckbox
              :model-value="user?.isUiLanguageAuto"
              @update:model-value="toggleAutoUiMode"
            >
              <template #label>
                <div class="flex flex-col select-none">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
                    <template v-if="user?.isUiLanguageAuto">
                      {{ t('settings.uiLanguageAutoWithLabel', { lang: effectiveUiLanguageName }) }}
                    </template>
                    <template v-else>
                      {{ t('settings.uiLanguageReturnAuto', 'Return to automatic mode') }}
                    </template>
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ t('settings.uiLanguageHelp', 'Language of buttons, menus and notifications.') }}
                  </span>
                </div>
              </template>
            </UCheckbox>
          </div>

          <!-- Manual Selection (Hidden if auto is enabled) -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="transform -translate-y-2 opacity-0"
            enter-to-class="transform translate-y-0 opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="transform translate-y-0 opacity-100"
            leave-to-class="transform -translate-y-2 opacity-0"
          >
            <div v-if="!user?.isUiLanguageAuto" class="pl-7 max-w-xs">
              <label class="block text-xs font-medium text-gray-500 mb-1.5">
                {{ t('settings.uiLanguageSelect', 'Select Interface Language') }}
              </label>
              <CommonLanguageSelect
                :model-value="user?.uiLanguage"
                mode="ui"
                @update:model-value="changeUiLanguage"
              />
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </UiAppCard>
</template>
