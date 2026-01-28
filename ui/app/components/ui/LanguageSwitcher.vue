<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

interface LocaleObject {
  code: string
  name: string
  file?: string
}

const availableLocales = computed(() => {
  return (locales.value as LocaleObject[]).map((l) => ({
    code: l.code,
    name: l.name,
  }))
})

const currentLocale = computed(() => {
  return availableLocales.value.find((l) => l.code === locale.value)
})

const { user, refreshUser, isAuthenticated } = useAuth()
const api = useApi()

async function switchLocale(code: string) {
  // Directly set locale for immediate feedback
  await setLocale(code as any)
  
  if (isAuthenticated.value) {
    try {
      // Update uiLanguage in DB
      await api.patch('/users/me', { uiLanguage: code })
      await refreshUser()
    } catch (e) {
      console.error('Failed to save UI language preference', e)
    }
  }
}
</script>

<template>
  <div class="w-32">
    <CommonLanguageSelect
      :model-value="user?.uiLanguage || locale"
      mode="ui"
      variant="ghost"
      size="sm"
      @update:model-value="switchLocale"
    />
  </div>
</template>
