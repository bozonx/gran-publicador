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

async function switchLocale(code: 'ru' | 'en') {
  await setLocale(code)
}
</script>

<template>
  <UDropdownMenu
    :items="
      availableLocales.map((l) => ({
        label: l.name,
        click: () => switchLocale(l.code as 'ru' | 'en'),
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
