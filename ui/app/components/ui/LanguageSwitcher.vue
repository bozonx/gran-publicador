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

const { refreshUser, isAuthenticated } = useAuth()
const api = useApi()

async function switchLocale(code: string) {
  // code might be 'ru-RU' or 'en-US' (from availableLocales)
  await setLocale(code as any)
  
  if (isAuthenticated.value) {
    try {
      await api.patch('/users/me', { language: code })
      await refreshUser()
    } catch (e) {
      console.error('Failed to save language preference', e)
    }
  }
}
</script>

<template>
  <UDropdownMenu
    :items="
      availableLocales.map((l) => ({
        label: l.name,
        click: () => switchLocale(l.code),
        active: l.code === locale,
      }))
    "
  >
    <UButton
      variant="ghost"
      size="sm"
      icon="i-lucide-languages"
      :label="currentLocale?.name"
      trailing-icon="i-lucide-chevron-down"
    />
  </UDropdownMenu>
</template>
